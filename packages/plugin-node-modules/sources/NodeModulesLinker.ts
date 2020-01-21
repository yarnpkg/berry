import {BuildDirective, MessageName, Project}                                                         from '@yarnpkg/core';
import {Linker, LinkOptions, MinimalLinkOptions, LinkType}                                            from '@yarnpkg/core';
import {Locator, Package, BuildType}                                                                  from '@yarnpkg/core';
import {structUtils, Report, Manifest, miscUtils, FinalizeInstallStatus, FetchResult, DependencyMeta} from '@yarnpkg/core';
import {VirtualFS, ZipOpenFS}                                                                         from '@yarnpkg/fslib';
import {PortablePath, npath, ppath, toFilename, Filename, xfs, FakeFS}                                from '@yarnpkg/fslib';
import {parseSyml}                                                                                    from '@yarnpkg/parsers';
import {AbstractPnpInstaller}                                                                         from '@yarnpkg/plugin-pnp';
import {NodeModulesLocatorMap, buildLocatorMap, buildNodeModulesTree}                                 from '@yarnpkg/pnpify';
import {PnpSettings, makeRuntimeApi}                                                                  from '@yarnpkg/pnp';
import {UsageError}                                                                                   from 'clipanion';
import fs                                                                                             from 'fs';
import pLimit                                                                                         from 'p-limit';

const NODE_MODULES = `node_modules` as Filename;
const INSTALL_STATE_FILE = `.yarn-state.yml` as Filename;

type LocationMap = Map<PortablePath, Locator>;

export class NodeModulesLinker implements Linker {
  supportsPackage(pkg: Package, opts: MinimalLinkOptions) {
    return opts.project.configuration.get(`nodeLinker`) === `node-modules`;
  }

  async findPackageLocation(locator: Locator, opts: LinkOptions) {
    const installState = await findInstallState(opts.project, {unrollAliases: true});
    if (installState === null)
      throw new UsageError(`Couldn't find the node_modules state file - running an install might help (findPackageLocation)`);

    const locatorInfo = installState.get(structUtils.stringifyLocator(locator));
    if (!locatorInfo)
      throw new UsageError(`Couldn't find ${structUtils.prettyLocator(opts.project.configuration, locator)} in the currently installed node_modules map - running an install might help`);

    return locatorInfo.locations[0];
  }

  async findPackageLocator(location: PortablePath, opts: LinkOptions) {
    const installState = await findInstallState(opts.project, {unrollAliases: true});
    if (installState === null)
      return null;

    const locationMap = getLocationMap(installState);

    // TODO: Doesn't support nested paths; we'd need to do something similar
    // to the `findPackageLocator` in the PnP API.
    //
    // ex: /.../node_modules/foo/subdirectory/another/file.js
    const locator = locationMap.get(location);
    if (typeof locator === `undefined`)
      return null;

    return locator;
  }

  makeInstaller(opts: LinkOptions) {
    return new NodeModulesInstaller(opts);
  }
}

class NodeModulesInstaller extends AbstractPnpInstaller {
  async getBuildScripts(locator: Locator, fetchResult: FetchResult) {
    return [];
  }

  async transformPackage(locator: Locator, dependencyMeta: DependencyMeta, packageFs: FakeFS<PortablePath>, flags: {hasBuildScripts: boolean}) {
    return packageFs;
  }

  async finalizeInstallWithPnp(pnpSettings: PnpSettings) {
    if (this.opts.project.configuration.get(`nodeLinker`) !== `node-modules`)
      return;

    const defaultFsLayer = new VirtualFS({
      baseFs: new ZipOpenFS({
        maxOpenFiles: 80,
        readOnlyArchives: true,
      }),
    });

    const preinstallState = await findInstallState(this.opts.project);

    // Remove build state as well, to force rebuild of all the packages
    if (preinstallState === null) {
      const bstatePath = this.opts.project.configuration.get(`bstatePath`);
      if (await xfs.existsPromise(bstatePath)) {
        await xfs.unlinkPromise(bstatePath);
      }
    }

    const pnp = makeRuntimeApi(pnpSettings, this.opts.project.cwd, defaultFsLayer);
    const nmTree = buildNodeModulesTree(pnp, {pnpifyFs: false});
    const installState = buildLocatorMap(nmTree);

    await persistNodeModules(preinstallState, installState, {
      baseFs: defaultFsLayer,
      project: this.opts.project,
      report: this.opts.report,
    });

    const installStatuses: Array<FinalizeInstallStatus> = [];

    for (const [locatorStr, installRecord] of installState.entries()) {
      const locator = structUtils.parseLocator(locatorStr);
      const pnpLocator = {name: structUtils.stringifyIdent(locator), reference: locator.reference};

      const pnpEntry = pnp.getPackageInformation(pnpLocator);
      if (pnpEntry === null)
        throw new Error(`Assertion failed: Expected the package to be registered (${structUtils.prettyLocator(this.opts.project.configuration, locator)})`);

      const sourceLocation = npath.toPortablePath(pnpEntry.packageLocation);

      const manifest = await Manifest.find(sourceLocation, {baseFs: defaultFsLayer});
      const buildScripts = await this.getSourceBuildScripts(sourceLocation, manifest);

      if (buildScripts.length > 0 && !this.opts.project.configuration.get(`enableScripts`)) {
        this.opts.report.reportWarningOnce(MessageName.DISABLED_BUILD_SCRIPTS, `${structUtils.prettyLocator(this.opts.project.configuration, locator)} lists build scripts, but all build scripts have been disabled.`);
        buildScripts.length = 0;
      }

      if (buildScripts.length > 0 && installRecord.linkType !== LinkType.HARD && !this.opts.project.tryWorkspaceByLocator(locator)) {
        this.opts.report.reportWarningOnce(MessageName.SOFT_LINK_BUILD, `${structUtils.prettyLocator(this.opts.project.configuration, locator)} lists build scripts, but is referenced through a soft link. Soft links don't support build scripts, so they'll be ignored.`);
        buildScripts.length = 0;
      }

      const dependencyMeta = this.opts.project.getDependencyMeta(locator, manifest.version);

      if (buildScripts.length > 0 && dependencyMeta && dependencyMeta.built === false) {
        this.opts.report.reportInfoOnce(MessageName.BUILD_DISABLED, `${structUtils.prettyLocator(this.opts.project.configuration, locator)} lists build scripts, but its build has been explicitly disabled through configuration.`);
        buildScripts.length = 0;
      }

      if (buildScripts.length > 0) {
        installStatuses.push({
          buildLocations: installRecord.locations,
          locatorHash: locator.locatorHash,
          buildDirective: buildScripts,
        });
      }
    }

    return installStatuses;
  }

  private async getSourceBuildScripts(packageLocation: PortablePath, manifest: Manifest): Promise<BuildDirective[]> {
    const buildScripts: BuildDirective[] = [];
    const {scripts} = manifest;

    for (const scriptName of [`preinstall`, `install`, `postinstall`])
      if (scripts.has(scriptName))
        buildScripts.push([BuildType.SCRIPT, scriptName]);

    // Detect cases where a package has a binding.gyp but no install script
    const bindingFilePath = ppath.resolve(packageLocation, toFilename(`binding.gyp`));
    if (!scripts.has(`install`) && xfs.existsSync(bindingFilePath))
      buildScripts.push([BuildType.SHELLCODE, `node-gyp rebuild`]);

    return buildScripts;
  }
}

async function writeInstallState(project: Project, locatorMap: NodeModulesLocatorMap) {
  let locatorState = ``;

  locatorState += `# Warning: This file is automatically generated. Removing it is fine, but will\n`;
  locatorState += `# cause your node_modules installation to become invalidated.\n`;
  locatorState += `\n`;
  locatorState += `__metadata:\n`;
  locatorState += `  version: 1\n`;

  for (const [locatorStr, installRecord] of locatorMap.entries()) {
    locatorState += `\n`;
    locatorState += `${JSON.stringify(locatorStr)}:\n`;
    locatorState += `  locations:\n`;

    for (const location of installRecord.locations) {
      const internalPath = ppath.contains(project.cwd, location);
      if (internalPath === null)
        throw new Error(`Assertion failed: Expected the path to be within the project (${location})`);

      locatorState += `    - ${JSON.stringify(internalPath)}\n`;
    }

    if (installRecord.aliases.length > 0) {
      locatorState += `  aliases:\n`;
      for (const alias of installRecord.aliases) {
        locatorState += `    - ${JSON.stringify(alias)}\n`;
      }
    }
  }

  const rootPath = project.cwd;
  const installStatePath = ppath.join(rootPath, NODE_MODULES, INSTALL_STATE_FILE);

  await xfs.changeFilePromise(installStatePath, locatorState, {
    automaticNewlines: true,
  });
};

async function findInstallState(project: Project, {unrollAliases = false}: {unrollAliases?: boolean} = {}): Promise<NodeModulesLocatorMap | null> {
  const rootPath = project.cwd;
  const installStatePath = ppath.join(rootPath, NODE_MODULES, INSTALL_STATE_FILE);

  if (!xfs.existsSync(installStatePath))
    return null;

  const locatorState = parseSyml(await xfs.readFilePromise(installStatePath, `utf8`));
  delete locatorState.__metadata;

  const locatorMap: NodeModulesLocatorMap = new Map();

  for (const [locatorStr, installRecord] of Object.entries(locatorState)) {
    const locations = installRecord.locations.map((location: PortablePath) => {
      return ppath.join(rootPath, location);
    });

    locatorMap.set(locatorStr, {
      target: PortablePath.dot,
      linkType: LinkType.HARD,
      locations: locations,
      aliases: installRecord.aliases || [],
    });

    if (unrollAliases && installRecord.aliases) {
      for (const reference of installRecord.aliases) {
        const {scope, name} = structUtils.parseLocator(locatorStr);

        const alias = structUtils.makeLocator(structUtils.makeIdent(scope, name), reference);
        const aliasStr = structUtils.stringifyLocator(alias);

        locatorMap.set(aliasStr, {
          target: PortablePath.dot,
          linkType: LinkType.HARD,
          locations: locations,
          aliases: [],
        });
      }
    }
  }

  return locatorMap;
};

function getLocationMap(installState: NodeModulesLocatorMap) {
  const locationMap: LocationMap = new Map();

  for (const [locatorKey, val] of installState) {
    const locator = structUtils.parseLocator(locatorKey);

    for (const location of val.locations) {
      locationMap.set(location, locator);
    }
  }

  return locationMap;
}

const removeDir = async (dir: PortablePath, options?: {innerLoop?: boolean, excludeNodeModules?: boolean}): Promise<any> => {
  try {
    if (!options || !options.innerLoop) {
      const stats = await xfs.lstatPromise(dir);
      if (!stats.isDirectory()) {
        await xfs.unlinkPromise(dir);
        return;
      }
    }
    const entries = await xfs.readdirPromise(dir, {withFileTypes: true});
    for (const entry of entries) {
      const targetPath = ppath.join(dir, toFilename(entry.name));
      if (entry.isDirectory()) {
        if (entry.name !== NODE_MODULES || !options || !options.excludeNodeModules) {
          await removeDir(targetPath, {innerLoop: true});
        }
      } else {
        await xfs.unlinkPromise(targetPath);
      }
    }
    await xfs.rmdirPromise(dir);
  } catch (e) {
    if (e.code !== 'ENOENT' && e.code !== 'ENOTEMPTY') {
      throw e;
    }
  }
};

const ADD_CONCURRENT_LIMIT = 4;

type LocatorKey = string;
type LocationNode = { children: Map<Filename, LocationNode>, locator?: LocatorKey };
type LocationRoot = PortablePath;

/**
 * Locations tree. It starts with the map of location roots and continues as maps
 * of nested directory entries.
 *
 * Example:
 *  Map {
 *   '' => children: Map {
 *     'react-apollo' => {
 *       children: Map {
 *         'node_modules' => {
 *           children: Map {
 *             '@apollo' => {
 *               children: Map {
 *                 'react-hooks' => {
 *                   children: Map {},
 *                   locator: '@apollo/react-hooks:virtual:cf51d203f9119859b7628364a64433e4a73a44a577d2ffd0dfd5dd737a980bc6cddc70ed15c1faf959fc2ad6a8e103ce52fe188f2b175b5f4371d4381544d74e#npm:3.1.3'
 *                 }
 *               }
 *             }
 *           }
 *         }
 *       },
 *       locator: 'react-apollo:virtual:2499dbb93d824027565d71b0716c4fb8b548ad61955d0a0286bfb3c5b4058e227894b6691d96808c00f576db14870018375210362c26ee321ea99fd6ed041c74#npm:3.1.3'
 *     },
 *   },
 *   'packages/client' => children: Map {
 *     'node_modules' => Map {
 *       ...
 *     }
 *   }
 *   ...
 * }
 */
type LocationTree = Map<LocationRoot, LocationNode>

const parseLocation = (location: PortablePath, {skipPrefix}: {skipPrefix: PortablePath}): {locationRoot: PortablePath, segments: Filename[]} => {
  const projectRelativePath = ppath.contains(skipPrefix, location);
  if (projectRelativePath === null)
    throw new Error(`Assertion failed: Cannot process a path that isn't part of the requested prefix (${location} isn't within ${skipPrefix})`);

  const allSegments = projectRelativePath.split(ppath.sep);
  const nmIndex = allSegments.indexOf(NODE_MODULES);

  // Project path, up until the first node_modules segment
  const relativeRoot = allSegments.slice(0, nmIndex + 1).join(ppath.sep) as PortablePath;
  const locationRoot = ppath.join(skipPrefix, relativeRoot);

  // All segments that follow
  const segments = allSegments.slice(nmIndex + 1) as Array<Filename>;

  return {locationRoot, segments};
};

const buildLocationTree = (locatorMap: NodeModulesLocatorMap | null, {skipPrefix}: {skipPrefix: PortablePath}): LocationTree => {
  const locationTree: LocationTree = new Map();
  if (locatorMap === null)
    return locationTree;

  const makeNode: () => LocationNode = () => ({
    children: new Map(),
  });

  for (const [locator, info] of locatorMap.entries()) {
    for (const location of info.locations) {
      const {locationRoot, segments} = parseLocation(location, {skipPrefix});

      let node = miscUtils.getFactoryWithDefault(locationTree, locationRoot, makeNode);

      for (let idx = 0; idx < segments.length; ++idx) {
        const segment = segments[idx];
        const nextNode = miscUtils.getFactoryWithDefault(node.children, segment, makeNode);

        node.children.set(segment, nextNode);
        node = nextNode;

        if (idx === segments.length - 1) {
          node.locator = locator;
        }
      }
    }
  }

  return locationTree;
};

const copyPromise = async (dstDir: PortablePath, srcDir: PortablePath, {baseFs}: {baseFs: FakeFS<PortablePath>}) => {
  await xfs.mkdirpPromise(dstDir);
  const entries = await baseFs.readdirPromise(srcDir, {withFileTypes: true});

  const copy = async (dstPath: PortablePath, srcPath: PortablePath, srcType: fs.Dirent) => {
    if (srcType.isFile()) {
      const stat = await baseFs.lstatPromise(srcPath);
      const content = await baseFs.readFilePromise(srcPath);
      await xfs.writeFilePromise(dstPath, content);
      const mode = stat.mode & 0o777;
      await xfs.chmodPromise(dstPath, mode);
    } else if (srcType.isSymbolicLink()) {
      const target = await baseFs.readlinkPromise(srcPath);
      await xfs.symlinkPromise(target, dstPath);
    } else {
      throw new Error(`Unsupported file type (file: ${srcPath}, mode: 0o${await xfs.statSync(srcPath).mode.toString(8).padStart(6, `0`)})`);
    }
  };

  for (const entry of entries) {
    const srcPath = ppath.join(srcDir, toFilename(entry.name));
    const dstPath = ppath.join(dstDir, toFilename(entry.name));
    if (entry.isDirectory()) {
      await copyPromise(dstPath, srcPath, {baseFs});
    } else {
      await copy(dstPath, srcPath, entry);
    }
  }
};

async function persistNodeModules(preinstallState: NodeModulesLocatorMap | null, installState: NodeModulesLocatorMap, {baseFs, project, report}: {project: Project, baseFs: FakeFS<PortablePath>, report: Report}) {
  const rootNmDirPath = ppath.join(project.cwd, NODE_MODULES);

  const prevLocationTree = buildLocationTree(preinstallState, {skipPrefix: project.cwd});
  const locationTree = buildLocationTree(installState, {skipPrefix: project.cwd});

  const limit = pLimit(ADD_CONCURRENT_LIMIT);

  const addQueue: Promise<void>[] = [];
  const addModule = async ({srcDir, dstDir, linkType, keepNodeModules}: {srcDir: PortablePath, dstDir: PortablePath, linkType: LinkType, keepNodeModules: boolean}) => {
    addQueue.push(limit(async () => {
      // Soft links to themselves are used to denote workspace packages, we
      // should just ignore them
      if (linkType === LinkType.SOFT && srcDir === dstDir)
        return;

      try {
        await removeDir(dstDir, {excludeNodeModules: keepNodeModules});
        if (linkType === LinkType.SOFT) {
          await xfs.mkdirpPromise(ppath.dirname(dstDir));
          await xfs.symlinkPromise(ppath.relative(ppath.dirname(dstDir), srcDir), dstDir);
        } else {
          await copyPromise(dstDir, srcDir, {baseFs});
        }
      } catch (e) {
        e.message = `While persisting ${srcDir} -> ${dstDir} ${e.message}`;
        throw e;
      } finally {
        progress.tick();
      }
    }));
  };

  const cloneModule = async (srcDir: PortablePath, dstDir: PortablePath, options?: { keepSrcNodeModules?: boolean, keepDstNodeModules?: boolean, innerLoop?: boolean }) => {
    try {
      if (!options || !options.innerLoop) {
        await removeDir(dstDir, {excludeNodeModules: options && options.keepDstNodeModules});
        await xfs.mkdirpPromise(dstDir);
      }

      const entries = await xfs.readdirPromise(srcDir, {withFileTypes: true});
      for (const entry of entries) {
        const src = ppath.join(srcDir, entry.name);
        const dst = ppath.join(dstDir, entry.name);

        if (entry.name !== NODE_MODULES || !options || !options.keepSrcNodeModules) {
          if (entry.isDirectory()) {
            await xfs.mkdirPromise(dst);
            await cloneModule(src, dst, {keepSrcNodeModules: false, keepDstNodeModules: false, innerLoop: true});
          } else {
            await xfs.copyFilePromise(src, dst, fs.constants.COPYFILE_FICLONE);
          }
        }
      }
    } catch (e) {
      if (!options || !options.innerLoop)
        e.message = `While cloning ${srcDir} -> ${dstDir} ${e.message}`;

      throw e;
    } finally {
      if (!options || !options.innerLoop) {
        progress.tick();
      }
    }
  };

  const deleteQueue: Promise<any>[] = [];
  const deleteModule = (dstDir: PortablePath) => {
    const promise = (async () => {
      try {
        await removeDir(dstDir);
      } catch (e) {
        e.message = `While removing ${dstDir} ${e.message}`;
        throw e;
      }
    })();
    deleteQueue.push(promise);
  };


  // Delete locations that no longer exist
  const deleteList: PortablePath[] = [];
  if (preinstallState !== null) {
    for (const {locations} of preinstallState.values()) {
      for (const location of locations) {
        const {locationRoot, segments} = parseLocation(location, {
          skipPrefix: project.cwd,
        });

        let node = locationTree.get(locationRoot);
        let curLocation = locationRoot;
        if (!node) {
          deleteList.push(curLocation);
        } else {
          for (const segment of segments) {
            curLocation = ppath.join(curLocation, segment);
            node = node.children.get(segment);
            if (!node) {
              deleteList.push(curLocation);
              break;
            }
          }
        }
      }
    }
  }

  for (const dstDir of deleteList)
    deleteModule(dstDir);

  // Update changed locations
  const addList: Array<{srcDir: PortablePath, dstDir: PortablePath, linkType: LinkType, keepNodeModules: boolean}> = [];
  if (preinstallState) {
    for (const [prevLocator, {locations}] of preinstallState.entries()) {
      for (const location of locations) {
        const {locationRoot, segments} = parseLocation(location, {
          skipPrefix: project.cwd,
        });

        let node = locationTree.get(locationRoot);
        let curLocation = locationRoot;
        if (node) {
          for (const segment of segments) {
            curLocation = ppath.join(curLocation, segment);
            node = node.children.get(segment);
            if (!node) {
              break;
            }
          }
          if (node && node.locator !== prevLocator) {
            const info = installState.get(node.locator!)!;
            const srcDir = info.target;
            const dstDir = curLocation;
            const linkType = info.linkType;
            const keepNodeModules = node.children.size > 0;
            addList.push({srcDir, dstDir, linkType, keepNodeModules});
          }
        }
      }
    }
  }

  // Add new locations
  for (const [locator, {locations}] of installState.entries()) {
    for (const location of locations) {
      const {locationRoot, segments} = parseLocation(location, {
        skipPrefix: project.cwd,
      });

      let prevTreeNode = prevLocationTree.get(locationRoot);
      let node = locationTree.get(locationRoot);
      let curLocation = locationRoot;

      const info = installState.get(locator)!;
      const srcDir = info.target;
      const dstDir = location;
      const linkType = info.linkType;

      for (const segment of segments)
        node = node!.children.get(segment);

      if (!prevTreeNode) {
        addList.push({srcDir, dstDir, linkType, keepNodeModules: node!.children.size > 0});
      } else {
        for (const segment of segments) {
          curLocation = ppath.join(curLocation, segment);
          prevTreeNode = prevTreeNode.children.get(segment);
          if (!prevTreeNode) {
            addList.push({srcDir, dstDir, linkType, keepNodeModules: node!.children.size > 0});
            break;
          }
        }
      }
    }
  }

  const progress = Report.progressViaCounter(addList.length);
  report.reportProgress(progress);

  const persistedLocations = new Map<PortablePath, {
    dstDir: PortablePath,
    keepNodeModules: boolean,
  }>();

  // For the first pass we'll only want to install a single copy for each
  // source directory. We'll later use the resulting install directories for
  // the other instances of the same package (this will avoid us having to
  // crawl the zip archives for each package).
  for (const entry of addList) {
    if (entry.linkType === LinkType.SOFT || !persistedLocations.has(entry.srcDir)) {
      persistedLocations.set(entry.srcDir, {dstDir: entry.dstDir, keepNodeModules: entry.keepNodeModules});
      await addModule({...entry});
    }
  }

  await Promise.all(deleteQueue);
  await Promise.all(addQueue);
  addQueue.length = 0;

  // Second pass: clone module duplicates
  for (const entry of addList) {
    const locationInfo = persistedLocations.get(entry.srcDir)!;
    if (entry.linkType !== LinkType.SOFT && entry.dstDir !== locationInfo.dstDir) {
      addQueue.push(cloneModule(locationInfo.dstDir, entry.dstDir, {keepSrcNodeModules: locationInfo.keepNodeModules, keepDstNodeModules: entry.keepNodeModules}));
    }
  }

  await Promise.all(addQueue);

  await xfs.mkdirpPromise(rootNmDirPath);
  await writeInstallState(project, installState);
};

