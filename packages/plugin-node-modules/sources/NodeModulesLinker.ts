import {BuildDirective, MessageName, Project}                                                         from '@yarnpkg/core';
import {Linker, LinkOptions, MinimalLinkOptions, LinkType}                                            from '@yarnpkg/core';
import {Locator, Package, BuildType}                                                                  from '@yarnpkg/core';
import {structUtils, Report, Manifest, miscUtils, FinalizeInstallStatus, FetchResult, DependencyMeta} from '@yarnpkg/core';
import {VirtualFS, ZipOpenFS}                                                                         from '@yarnpkg/fslib';
import {PortablePath, npath, ppath, toFilename, Filename, xfs, FakeFS}                                from '@yarnpkg/fslib';
import {getLibzipPromise}                                                                             from '@yarnpkg/libzip';
import {parseSyml}                                                                                    from '@yarnpkg/parsers';
import {AbstractPnpInstaller}                                                                         from '@yarnpkg/plugin-pnp';
import {NodeModulesLocatorMap, buildLocatorMap, buildNodeModulesTree}                                 from '@yarnpkg/pnpify';
import {PnpSettings, makeRuntimeApi}                                                                  from '@yarnpkg/pnp';
import cmdShim                                                                                        from '@zkochan/cmd-shim';
import {UsageError}                                                                                   from 'clipanion';
import fs                                                                                             from 'fs';

const STATE_FILE_VERSION = 1;
const NODE_MODULES = `node_modules` as Filename;
const DOT_BIN = `.bin` as Filename;
const INSTALL_STATE_FILE = `.yarn-state.yml` as Filename;

type LocationMap = Map<PortablePath, Locator>;
type InstallState = {locatorMap: NodeModulesLocatorMap, binSymlinks: BinSymlinkMap};
type BinSymlinkMap = Map<PortablePath, Map<Filename, PortablePath>>;

export class NodeModulesLinker implements Linker {
  supportsPackage(pkg: Package, opts: MinimalLinkOptions) {
    return opts.project.configuration.get(`nodeLinker`) === `node-modules`;
  }

  async findPackageLocation(locator: Locator, opts: LinkOptions) {
    const installState = await findInstallState(opts.project, {unrollAliases: true});
    if (installState === null)
      throw new UsageError(`Couldn't find the node_modules state file - running an install might help (findPackageLocation)`);

    const locatorInfo = installState.locatorMap.get(structUtils.stringifyLocator(locator));
    if (!locatorInfo)
      throw new UsageError(`Couldn't find ${structUtils.prettyLocator(opts.project.configuration, locator)} in the currently installed node_modules map - running an install might help`);

    return locatorInfo.locations[0];
  }

  async findPackageLocator(location: PortablePath, opts: LinkOptions) {
    const installState = await findInstallState(opts.project, {unrollAliases: true});
    if (installState === null)
      return null;

    const locationMap = getLocationMap(installState.locatorMap);

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
  async getBuildScripts(locator: Locator, manifest: Manifest | null, fetchResult: FetchResult) {
    return [];
  }

  async transformPackage(locator: Locator, manifest: Manifest | null, fetchResult: FetchResult, dependencyMeta: DependencyMeta, flags: {hasBuildScripts: boolean}) {
    return fetchResult.packageFs;
  }

  async finalizeInstallWithPnp(pnpSettings: PnpSettings) {
    if (this.opts.project.configuration.get(`nodeLinker`) !== `node-modules`)
      return;

    const defaultFsLayer = new VirtualFS({
      baseFs: new ZipOpenFS({
        libzip: await getLibzipPromise(),
        maxOpenFiles: 80,
        readOnlyArchives: true,
      }),
    });

    let preinstallState = await findInstallState(this.opts.project);

    // Remove build state as well, to force rebuild of all the packages
    if (preinstallState === null) {
      const bstatePath = this.opts.project.configuration.get(`bstatePath`);
      if (await xfs.existsPromise(bstatePath))
        await xfs.unlinkPromise(bstatePath);

      preinstallState = {locatorMap: new Map(), binSymlinks: new Map()};
    }

    const pnp = makeRuntimeApi(pnpSettings, this.opts.project.cwd, defaultFsLayer);
    const nmTree = buildNodeModulesTree(pnp, {pnpifyFs: false});
    const locatorMap = buildLocatorMap(nmTree);

    await persistNodeModules(preinstallState, locatorMap, {
      baseFs: defaultFsLayer,
      project: this.opts.project,
      report: this.opts.report,
      loadManifest: this.cachedManifestLoad.bind(this),
    });

    const installStatuses: Array<FinalizeInstallStatus> = [];

    for (const [locatorStr, installRecord] of locatorMap.entries()) {
      const locator = structUtils.parseLocator(locatorStr);
      const pnpLocator = {name: structUtils.stringifyIdent(locator), reference: locator.reference};

      const pnpEntry = pnp.getPackageInformation(pnpLocator);
      if (pnpEntry === null)
        throw new Error(`Assertion failed: Expected the package to be registered (${structUtils.prettyLocator(this.opts.project.configuration, locator)})`);

      const sourceLocation = npath.toPortablePath(installRecord.locations[0]);

      const manifest = await this.cachedManifestLoad(sourceLocation);
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

  private manifestCache: Map<PortablePath, Manifest> = new Map();

  private async cachedManifestLoad(sourceLocation: PortablePath): Promise<Manifest> {
    let manifest = this.manifestCache.get(sourceLocation);
    if (manifest)
      return manifest;

    manifest = await Manifest.find(sourceLocation);
    this.manifestCache.set(sourceLocation, manifest);

    return manifest;
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

async function writeInstallState(project: Project, locatorMap: NodeModulesLocatorMap, binSymlinks: BinSymlinkMap) {
  let locatorState = ``;

  locatorState += `# Warning: This file is automatically generated. Removing it is fine, but will\n`;
  locatorState += `# cause your node_modules installation to become invalidated.\n`;
  locatorState += `\n`;
  locatorState += `__metadata:\n`;
  locatorState += `  version: ${STATE_FILE_VERSION}\n`;

  const locators = Array.from(locatorMap.keys()).sort();

  for (const locator of locators) {
    const installRecord = locatorMap.get(locator)!;
    locatorState += `\n`;
    locatorState += `${JSON.stringify(locator)}:\n`;
    locatorState += `  locations:\n`;

    let topLevelLocator = false;
    for (const location of installRecord.locations) {
      const internalPath = ppath.contains(project.cwd, location);
      if (internalPath === null)
        throw new Error(`Assertion failed: Expected the path to be within the project (${location})`);

      locatorState += `    - ${JSON.stringify(internalPath)}\n`;

      if (location === project.cwd) {
        topLevelLocator = true;
      }
    }

    if (installRecord.aliases.length > 0) {
      locatorState += `  aliases:\n`;
      for (const alias of installRecord.aliases) {
        locatorState += `    - ${JSON.stringify(alias)}\n`;
      }
    }

    if (topLevelLocator && binSymlinks.size > 0) {
      locatorState += `  bin:\n`;
      for (const [location, symlinks] of binSymlinks) {
        const internalPath = ppath.contains(project.cwd, location);
        if (internalPath === null)
          throw new Error(`Assertion failed: Expected the path to be within the project (${location})`);

        locatorState += `    ${JSON.stringify(internalPath)}:\n`;
        for (const [name, target] of symlinks) {
          const relativePath = ppath.relative(ppath.join(location, NODE_MODULES), target);
          locatorState += `      ${JSON.stringify(name)}: ${JSON.stringify(relativePath)}\n`;
        }
      }
    }
  }

  const rootPath = project.cwd;
  const installStatePath = ppath.join(rootPath, NODE_MODULES, INSTALL_STATE_FILE);

  await xfs.changeFilePromise(installStatePath, locatorState, {
    automaticNewlines: true,
  });
};

async function findInstallState(project: Project, {unrollAliases = false}: {unrollAliases?: boolean} = {}): Promise<InstallState | null> {
  const rootPath = project.cwd;
  const installStatePath = ppath.join(rootPath, NODE_MODULES, INSTALL_STATE_FILE);

  if (!xfs.existsSync(installStatePath))
    return null;

  const locatorState = parseSyml(await xfs.readFilePromise(installStatePath, `utf8`));

  // If we have a higher serialized version than we can handle, ignore the state alltogether
  if (locatorState.__metadata.version > STATE_FILE_VERSION)
    return null;

  const locatorMap: NodeModulesLocatorMap = new Map();
  const binSymlinks: BinSymlinkMap = new Map();

  delete locatorState.__metadata;

  for (const [locatorStr, installRecord] of Object.entries(locatorState)) {
    const locations = installRecord.locations.map((location: PortablePath) => {
      return ppath.join(rootPath, location);
    });

    const recordSymlinks = installRecord.bin;
    if (recordSymlinks) {
      for (const [location, locationSymlinks] of Object.entries(recordSymlinks)) {
        const symlinks = miscUtils.getMapWithDefault(binSymlinks, location);
        for (const [name, target] of Object.entries(locationSymlinks as any)) {
          symlinks.set(toFilename(name), npath.toPortablePath([location, NODE_MODULES, target].join(ppath.delimiter)));
        }
      }
    }

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

  return {locatorMap, binSymlinks};
};

function getLocationMap(installState: NodeModulesLocatorMap) {
  const locationMap: LocationMap = new Map();

  for (const [locatorKey, val] of installState) {
    const locator = structUtils.parseLocator(locatorKey);

    if (val.linkType === LinkType.SOFT)
      locationMap.set(val.target, locator);

    for (const location of val.locations) {
      locationMap.set(location, locator);
    }
  }

  return locationMap;
}

const removeDir = async (dir: PortablePath, options?: {innerLoop?: boolean}): Promise<any> => {
  if (dir.split(ppath.sep).indexOf(NODE_MODULES) < 0)
    throw new Error(`Assertion failed: trying to remove dir that doesn't contain node_modules: ${dir}`);

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
        if (entry.name !== NODE_MODULES || (options && options.innerLoop)) {
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

const CONCURRENT_OPERATION_LIMIT = 4;

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
  const relativeRoot = allSegments.slice(0, nmIndex).join(ppath.sep) as PortablePath;
  const locationRoot = ppath.join(skipPrefix, relativeRoot);

  // All segments that follow
  const segments = allSegments.slice(nmIndex) as Array<Filename>;

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
    if (info.linkType === LinkType.SOFT) {
      const node = miscUtils.getFactoryWithDefault(locationTree, info.target, makeNode);
      node.locator = locator;
    }

    for (const location of info.locations) {
      const {locationRoot, segments} = parseLocation(location, {skipPrefix});

      let node = miscUtils.getFactoryWithDefault(locationTree, locationRoot, makeNode);

      for (let idx = 0; idx < segments.length; ++idx) {
        const segment = segments[idx];
        // '.' segment exists only for top-level locator, skip it
        if (segment !== '.') {
          const nextNode = miscUtils.getFactoryWithDefault(node.children, segment, makeNode);

          node.children.set(segment, nextNode);
          node = nextNode;
        }

        if (idx === segments.length - 1) {
          node.locator = locator;
        }
      }
    }
  }

  return locationTree;
};

const symlinkPromise = async (srcDir: PortablePath, dstDir: PortablePath) =>
  xfs.symlinkPromise(process.platform !== 'win32' ? ppath.relative(ppath.dirname(dstDir), srcDir) : srcDir, dstDir, process.platform === 'win32' ? 'junction' : undefined);

const copyPromise = async (dstDir: PortablePath, srcDir: PortablePath, {baseFs, innerLoop}: {baseFs: FakeFS<PortablePath>, innerLoop?: boolean}) => {
  await xfs.mkdirpPromise(dstDir);
  const entries = await baseFs.readdirPromise(srcDir, {withFileTypes: true});

  const copy = async (dstPath: PortablePath, srcPath: PortablePath, srcType: fs.Dirent) => {
    if (srcType.isFile()) {
      const stat = await baseFs.lstatPromise(srcPath);
      await baseFs.copyFilePromise(srcPath, dstPath);
      const mode = stat.mode & 0o777;
      // An optimization - files will have rw-r-r permissions (0o644) by default, we can skip chmod for them
      if (mode !== 0o644) {
        await xfs.chmodPromise(dstPath, mode);
      }
    } else if (srcType.isSymbolicLink()) {
      const target = await baseFs.readlinkPromise(srcPath);
      await symlinkPromise(ppath.resolve(srcPath, target), dstPath);
    } else {
      throw new Error(`Unsupported file type (file: ${srcPath}, mode: 0o${await xfs.statSync(srcPath).mode.toString(8).padStart(6, `0`)})`);
    }
  };

  for (const entry of entries) {
    const srcPath = ppath.join(srcDir, toFilename(entry.name));
    const dstPath = ppath.join(dstDir, toFilename(entry.name));
    if (entry.isDirectory()) {
      if (entry.name !== NODE_MODULES || innerLoop) {
        await copyPromise(dstPath, srcPath, {baseFs, innerLoop: true});
      }
    } else {
      await copy(dstPath, srcPath, entry);
    }
  }
};

/**
 * This function removes node_modules roots that do not exist on the filesystem from the location tree.
 *
 * This is needed to transparently support workflows on CI systems. When
 * user caches only top-level node_modules and forgets to cache node_modules
 * from deeper workspaces. By removing non-existent node_modules roots
 * we make our location tree to represent the real tree on the file system.
 *
 * Please note, that this function doesn't help with any other inconsistency
 * on a deeper level inside node_modules tree, it helps only when some node_modules roots
 * do not exist at all
 *
 * @param locationTree location tree
 *
 * @returns location tree with non-existent node_modules roots stripped
 */
function refineNodeModulesRoots(locationTree: LocationTree, binSymlinks: BinSymlinkMap): {locationTree: LocationTree, binSymlinks: BinSymlinkMap} {
  const refinedLocationTree: LocationTree = new Map([...locationTree]);
  const refinedBinSymlinks: BinSymlinkMap = new Map([...binSymlinks]);

  for (const [workspaceRoot, node] of locationTree) {
    const nodeModulesRoot = ppath.join(workspaceRoot, NODE_MODULES);
    if (!xfs.existsSync(nodeModulesRoot)) {
      node.children.delete(NODE_MODULES);

      // O(m^2) complexity algorithm, but on a very few values, so not worth the trouble to optimize it
      for (const location of refinedBinSymlinks.keys()) {
        if (ppath.contains(nodeModulesRoot, location) !== null) {
          refinedBinSymlinks.delete(location);
        }
      }
    }
  }

  return {locationTree: refinedLocationTree, binSymlinks: refinedBinSymlinks};
};

async function createBinSymlinkMap(installState: NodeModulesLocatorMap, locationTree: LocationTree, {loadManifest}: {loadManifest: (sourceLocation: PortablePath) => Promise<Manifest>}) {
  const locatorScriptMap = new Map<LocatorKey, Map<string, string>>();
  for (const [locatorKey, {locations}] of installState) {
    const manifest = await loadManifest(locations[0]);

    const bin = new Map();
    for (const [name, value] of manifest.bin)
      if (value !== '')
        bin.set(name, value);

    locatorScriptMap.set(locatorKey, bin);
  }

  const binSymlinks: BinSymlinkMap = new Map();

  const getBinSymlinks = (location: PortablePath, parentLocatorLocation: PortablePath, node: LocationNode): Map<Filename, PortablePath> => {
    const symlinks = new Map();
    if (node.locator) {
      const binScripts = locatorScriptMap.get(node.locator)!;
      for (const [filename, scriptPath] of binScripts) {
        const symlinkTarget = ppath.join(location, npath.toPortablePath(scriptPath));
        symlinks.set(toFilename(filename), symlinkTarget);
      }
      for (const [childLocation, childNode] of node.children) {
        const absChildLocation = ppath.join(location, childLocation);
        const childSymlinks = getBinSymlinks(absChildLocation, absChildLocation, childNode);
        if (childSymlinks.size > 0) {
          binSymlinks.set(location, childSymlinks);
        }
      }
    } else {
      for (const [childLocation, childNode] of node.children) {
        const childSymlinks = getBinSymlinks(ppath.join(location, childLocation), parentLocatorLocation, childNode);
        for (const [name, symlinkTarget] of childSymlinks) {
          symlinks.set(name, symlinkTarget);
        }
      }
    }
    return symlinks;
  };

  for (const [location, node] of locationTree) {
    const symlinks = getBinSymlinks(location, location, node);
    if (symlinks.size > 0) {
      binSymlinks.set(location, symlinks);
    }
  }

  return binSymlinks;
}

async function persistNodeModules(preinstallState: InstallState, installState: NodeModulesLocatorMap, {baseFs, project, report, loadManifest}: {project: Project, baseFs: FakeFS<PortablePath>, report: Report, loadManifest: (sourceLocation: PortablePath) => Promise<Manifest>}) {
  const rootNmDirPath = ppath.join(project.cwd, NODE_MODULES);

  const {locationTree: prevLocationTree, binSymlinks: prevBinSymlinks} = refineNodeModulesRoots(buildLocationTree(preinstallState.locatorMap, {skipPrefix: project.cwd}), preinstallState.binSymlinks);
  const locationTree = buildLocationTree(installState, {skipPrefix: project.cwd});

  const addQueue: Promise<void>[] = [];
  const addModule = async ({srcDir, dstDir, linkType}: {srcDir: PortablePath, dstDir: PortablePath, linkType: LinkType}) => {
    const promise: Promise<any> = (async () => {
      try {
        if (linkType === LinkType.SOFT) {
          await xfs.mkdirpPromise(ppath.dirname(dstDir));
          await symlinkPromise(ppath.resolve(srcDir), dstDir);
        } else {
          await copyPromise(dstDir, srcDir, {baseFs});
        }
      } catch (e) {
        e.message = `While persisting ${srcDir} -> ${dstDir} ${e.message}`;
        throw e;
      } finally {
        progress.tick();
      }
    })().then(() => addQueue.splice(addQueue.indexOf(promise), 1));
    addQueue.push(promise);
    if (addQueue.length > CONCURRENT_OPERATION_LIMIT) {
      await Promise.race(addQueue);
    }
  };

  const cloneModule = async (srcDir: PortablePath, dstDir: PortablePath, options?: { innerLoop?: boolean }) => {
    const promise: Promise<any> = (async () => {
      const cloneDir = async (srcDir: PortablePath, dstDir: PortablePath, options?: { innerLoop?: boolean }) => {
        try {
          if (!options || !options.innerLoop)
            await xfs.mkdirpPromise(dstDir);

          const entries = await xfs.readdirPromise(srcDir, {withFileTypes: true});
          for (const entry of entries) {
            if ((!options || !options.innerLoop) && entry.name === DOT_BIN)
              continue;

            const src = ppath.join(srcDir, entry.name);
            const dst = ppath.join(dstDir, entry.name);

            if (entry.isDirectory()) {
              if (entry.name !== NODE_MODULES || (options && options.innerLoop)) {
                await xfs.mkdirpPromise(dst);
                await cloneDir(src, dst, {innerLoop: true});
              }
            } else {
              await xfs.copyFilePromise(src, dst, fs.constants.COPYFILE_FICLONE);
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

      await cloneDir(srcDir, dstDir, options);
    })().then(() => addQueue.splice(addQueue.indexOf(promise), 1));
    addQueue.push(promise);
    if (addQueue.length > CONCURRENT_OPERATION_LIMIT) {
      await Promise.race(addQueue);
    }
  };

  const deleteQueue: Promise<any>[] = [];
  const deleteModule = async (dstDir: PortablePath) => {
    const promise: Promise<any> = (async () => {
      try {
        await removeDir(dstDir);
      } catch (e) {
        e.message = `While removing ${dstDir} ${e.message}`;
        throw e;
      }
    })().then(() => deleteQueue.splice(deleteQueue.indexOf(promise), 1));
    deleteQueue.push(promise);
    if (deleteQueue.length > CONCURRENT_OPERATION_LIMIT) {
      await Promise.race(deleteQueue);
    }
  };


  // Delete locations that no longer exist
  const deleteList = new Set<PortablePath>();
  // Delete locations of inner node_modules
  const innerDeleteList = new Set<PortablePath>();
  for (const {locations} of preinstallState.locatorMap.values()) {
    for (const location of locations) {
      const {locationRoot, segments} = parseLocation(location, {
        skipPrefix: project.cwd,
      });

      let prevNode = prevLocationTree.get(locationRoot);
      let node = locationTree.get(locationRoot);
      let curLocation = locationRoot;
      if (node) {
        for (const segment of segments) {
          // '.' segment exists only for top-level locator, skip it
          if (segment === '.')
            continue;

          curLocation = ppath.join(curLocation, segment);
          node = node.children.get(segment);
          if (prevNode)
            prevNode = prevNode.children.get(segment);

          if (!node) {
            deleteList.add(curLocation);
            // If previous install had inner node_modules folder, we should explicitely list it for
            // `removeDir` to delete it, but we need to delete it first, so we add it to inner delete list
            if (prevNode && prevNode.children.has(NODE_MODULES))
              innerDeleteList.add(ppath.join(curLocation, NODE_MODULES));
            break;
          }
        }
      }
    }
  }

  // Handle inner node_modules deletions first
  for (const dstDir of innerDeleteList)
    await deleteModule(dstDir);
  await Promise.all(deleteQueue);
  deleteQueue.length = 0;

  for (const dstDir of deleteList)
    await deleteModule(dstDir);

  // Update changed locations
  const addList: Array<{srcDir: PortablePath, dstDir: PortablePath, linkType: LinkType}> = [];
  for (const [prevLocator, {locations}] of preinstallState.locatorMap.entries()) {
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
          if (srcDir !== dstDir) {
            deleteList.add(dstDir);
            addList.push({srcDir, dstDir, linkType});
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
      if (srcDir === dstDir)
        continue;

      const linkType = info.linkType;

      for (const segment of segments)
        node = node!.children.get(segment);

      if (!prevTreeNode) {
        deleteList.add(dstDir);
        addList.push({srcDir, dstDir, linkType});
      } else {
        for (const segment of segments) {
          curLocation = ppath.join(curLocation, segment);
          prevTreeNode = prevTreeNode.children.get(segment);
          if (!prevTreeNode) {
            deleteList.add(dstDir);
            addList.push({srcDir, dstDir, linkType});
            break;
          }
        }
      }
    }
  }

  const progress = Report.progressViaCounter(addList.length);
  const reportedProgress = report.reportProgress(progress);

  try {
    const persistedLocations = new Map<PortablePath, PortablePath>();

    // For the first pass we'll only want to install a single copy for each
    // source directory. We'll later use the resulting install directories for
    // the other instances of the same package (this will avoid us having to
    // crawl the zip archives for each package).
    for (const entry of addList) {
      if (entry.linkType === LinkType.SOFT || !persistedLocations.has(entry.srcDir)) {
        persistedLocations.set(entry.srcDir, entry.dstDir);
        await addModule({...entry});
      }
    }

    await Promise.all(deleteQueue);
    await Promise.all(addQueue);
    addQueue.length = 0;

    // Second pass: clone module duplicates
    for (const entry of addList) {
      const persistedDir = persistedLocations.get(entry.srcDir)!;
      if (entry.linkType !== LinkType.SOFT && entry.dstDir !== persistedDir) {
        await cloneModule(persistedDir, entry.dstDir);
      }
    }

    await Promise.all(addQueue);

    await xfs.mkdirpPromise(rootNmDirPath);

    const binSymlinks = await createBinSymlinkMap(installState, locationTree, {loadManifest});
    await persistBinSymlinks(prevBinSymlinks, binSymlinks);

    await writeInstallState(project, installState, binSymlinks);
  } finally {
    reportedProgress.stop();
  }
};

async function persistBinSymlinks(previousBinSymlinks: BinSymlinkMap, binSymlinks: BinSymlinkMap) {
  // Delete outdated .bin folders
  for (const location of previousBinSymlinks.keys()) {
    if (!binSymlinks.has(location)) {
      const binDir = ppath.join(location, NODE_MODULES, DOT_BIN);
      await xfs.removePromise(binDir);
    }
  }

  for (const [location, symlinks] of binSymlinks) {
    const binDir = ppath.join(location, NODE_MODULES, DOT_BIN);
    const prevSymlinks = previousBinSymlinks.get(location) || new Map();
    await xfs.mkdirpPromise(binDir);
    for (const name of prevSymlinks.keys()) {
      if (!symlinks.has(name)) {
        // Remove outdated symlinks
        await xfs.removePromise(ppath.join(binDir, name));
      }
    }

    for (const [name, target] of symlinks) {
      const prevTarget = prevSymlinks.get(name);
      const symlinkPath = ppath.join(binDir, name);
      // Skip unchanged .bin symlinks
      if (prevTarget === target)
        continue;

      if (process.platform === 'win32') {
        await cmdShim(npath.fromPortablePath(target), npath.fromPortablePath(symlinkPath), {createPwshFile: false});
      } else {
        await xfs.removePromise(symlinkPath);
        await symlinkPromise(target, symlinkPath);
      }
    }
  }
}
