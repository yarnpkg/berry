import {CwdFS, Filename, NativePath, PortablePath, ZipOpenFS} from '@yarnpkg/fslib';
import {xfs, npath, ppath, toFilename}                        from '@yarnpkg/fslib';
import {getLibzipPromise}                                     from '@yarnpkg/libzip';
import {execute}                                              from '@yarnpkg/shell';
import capitalize                                             from 'lodash/capitalize';
import pLimit                                                 from 'p-limit';
import {PassThrough, Readable, Writable}                      from 'stream';

import {Configuration}                                        from './Configuration';
import {Manifest}                                             from './Manifest';
import {MessageName}                                          from './MessageName';
import {Project}                                              from './Project';
import {ReportError, Report}                                  from './Report';
import {StreamReport}                                         from './StreamReport';
import {Workspace}                                            from './Workspace';
import {YarnVersion}                                          from './YarnVersion';
import * as execUtils                                         from './execUtils';
import * as formatUtils                                       from './formatUtils';
import * as miscUtils                                         from './miscUtils';
import * as structUtils                                       from './structUtils';
import {LocatorHash, Locator}                                 from './types';

enum PackageManager {
  Yarn1 = `Yarn Classic`,
  Yarn2 = `Yarn`,
  Npm = `npm`,
  Pnpm = `pnpm`,
}

interface PackageManagerSelection {
  packageManager: PackageManager;
  reason: string;
}

async function makePathWrapper(location: PortablePath, name: Filename, argv0: NativePath, args: Array<string> = []) {
  if (process.platform === `win32`) {
    // https://github.com/microsoft/terminal/issues/217#issuecomment-737594785
    const cmdScript = `@goto #_undefined_# 2>NUL || @title %COMSPEC% & @setlocal & @"${argv0}" ${args.map(arg => `"${arg.replace(`"`, `""`)}"`).join(` `)} %*`;
    await xfs.writeFilePromise(ppath.format({dir: location, name, ext: `.cmd`}), cmdScript);
  }

  await xfs.writeFilePromise(ppath.join(location, name), `#!/bin/sh\nexec "${argv0}" ${args.map(arg => `'${arg.replace(/'/g, `'"'"'`)}'`).join(` `)} "$@"\n`);
  await xfs.chmodPromise(ppath.join(location, name), 0o755);
}

async function detectPackageManager(location: PortablePath): Promise<PackageManagerSelection | null> {
  let yarnLock = null;
  try {
    yarnLock = await xfs.readFilePromise(ppath.join(location, Filename.lockfile), `utf8`);
  } catch {}

  if (yarnLock !== null) {
    if (yarnLock.match(/^__metadata:$/m)) {
      return {packageManager: PackageManager.Yarn2, reason: `"__metadata" key found in yarn.lock`};
    } else {
      return {
        packageManager: PackageManager.Yarn1,
        reason: `"__metadata" key not found in yarn.lock, must be a Yarn classic lockfile`,
      };
    }
  }

  if (xfs.existsSync(ppath.join(location, `package-lock.json` as PortablePath)))
    return {packageManager: PackageManager.Npm, reason: `found npm's "package-lock.json" lockfile`};


  if (xfs.existsSync(ppath.join(location, `pnpm-lock.yaml` as PortablePath)))
    return {packageManager: PackageManager.Pnpm, reason: `found pnpm's "pnpm-lock.yaml" lockfile`};

  return null;
}

export async function makeScriptEnv({project, locator, binFolder, lifecycleScript}: {project?: Project, locator?: Locator, binFolder: PortablePath, lifecycleScript?: string}) {
  const scriptEnv: {[key: string]: string} = {};
  for (const [key, value] of Object.entries(process.env))
    if (typeof value !== `undefined`)
      scriptEnv[key.toLowerCase() !== `path` ? key : `PATH`] = value;

  const nBinFolder = npath.fromPortablePath(binFolder);

  // We expose the base folder in the environment so that we can later add the
  // binaries for the dependencies of the active package
  scriptEnv.BERRY_BIN_FOLDER = npath.fromPortablePath(nBinFolder);

  // Otherwise we'd override the Corepack binaries, and thus break the detection
  // of the `packageManager` field when running Yarn in other directories.
  const yarnBin = process.env.COREPACK_ROOT
    ? npath.join(process.env.COREPACK_ROOT, `dist/yarn.js`)
    : process.argv[1];

  // Register some binaries that must be made available in all subprocesses
  // spawned by Yarn (we thus ensure that they always use the right version)
  await Promise.all([
    makePathWrapper(binFolder, `node` as Filename, process.execPath),
    ...YarnVersion !== null ? [
      makePathWrapper(binFolder, `run` as Filename, process.execPath, [yarnBin, `run`]),
      makePathWrapper(binFolder, `yarn` as Filename, process.execPath, [yarnBin]),
      makePathWrapper(binFolder, `yarnpkg` as Filename, process.execPath, [yarnBin]),
      makePathWrapper(binFolder, `node-gyp` as Filename, process.execPath, [yarnBin, `run`, `--top-level`, `node-gyp`]),
    ] : [],
  ]);

  if (project) {
    scriptEnv.INIT_CWD = npath.fromPortablePath(project.configuration.startingCwd);
    scriptEnv.PROJECT_CWD = npath.fromPortablePath(project.cwd);
  }

  scriptEnv.PATH = scriptEnv.PATH
    ? `${nBinFolder}${npath.delimiter}${scriptEnv.PATH}`
    : `${nBinFolder}`;

  scriptEnv.npm_execpath = `${nBinFolder}${npath.sep}yarn`;
  scriptEnv.npm_node_execpath = `${nBinFolder}${npath.sep}node`;

  if (locator) {
    if (!project)
      throw new Error(`Assertion failed: Missing project`);

    // Workspaces have 0.0.0-use.local in their "pkg" registrations, so we
    // need to access the actual workspace to get its real version.
    const workspace = project.tryWorkspaceByLocator(locator);
    const version = workspace
      ? workspace.manifest.version ?? ``
      : project.storedPackages.get(locator.locatorHash)!.version ?? ``;

    scriptEnv.npm_package_name = structUtils.stringifyIdent(locator);
    scriptEnv.npm_package_version = version;
  }

  const version = YarnVersion !== null
    ? `yarn/${YarnVersion}`
    : `yarn/${miscUtils.dynamicRequire(`@yarnpkg/core`).version}-core`;

  scriptEnv.npm_config_user_agent = `${version} npm/? node/${process.versions.node} ${process.platform} ${process.arch}`;

  if (lifecycleScript)
    scriptEnv.npm_lifecycle_event = lifecycleScript;

  if (project) {
    await project.configuration.triggerHook(
      hook => hook.setupScriptEnvironment,
      project,
      scriptEnv,
      async (name: string, argv0: string, args: Array<string>) => {
        return await makePathWrapper(binFolder, toFilename(name), argv0, args);
      },
    );
  }

  return scriptEnv as (typeof scriptEnv) & {BERRY_BIN_FOLDER: string};
}

/**
 * Given a folder, prepares this project for use. Runs `yarn install` then
 * `yarn build` if a `package.json` is found.
 */

const MAX_PREPARE_CONCURRENCY = 2;
const prepareLimit = pLimit(MAX_PREPARE_CONCURRENCY);

export async function prepareExternalProject(cwd: PortablePath, outputPath: PortablePath, {configuration, report, workspace = null, locator = null}: {configuration: Configuration, report: Report, workspace?: string | null, locator?: Locator | null}) {
  await prepareLimit(async () => {
    await xfs.mktempPromise(async logDir => {
      const logFile = ppath.join(logDir, `pack.log` as Filename);

      const stdin = null;
      const {stdout, stderr} = configuration.getSubprocessStreams(logFile, {prefix: npath.fromPortablePath(cwd), report});

      const devirtualizedLocator = locator && structUtils.isVirtualLocator(locator)
        ? structUtils.devirtualizeLocator(locator)
        : locator;

      const name = devirtualizedLocator
        ? structUtils.stringifyLocator(devirtualizedLocator)
        : `an external project`;

      stdout.write(`Packing ${name} from sources\n`);

      const packageManagerSelection = await detectPackageManager(cwd);
      let effectivePackageManager: PackageManager;

      if (packageManagerSelection !== null) {
        stdout.write(`Using ${packageManagerSelection.packageManager} for bootstrap. Reason: ${packageManagerSelection.reason}\n\n`);
        effectivePackageManager = packageManagerSelection.packageManager;
      } else {
        stdout.write(`No package manager configuration detected; defaulting to Yarn\n\n`);
        effectivePackageManager = PackageManager.Yarn2;
      }

      await xfs.mktempPromise(async binFolder => {
        const env = await makeScriptEnv({binFolder});

        const workflows = new Map([
          [PackageManager.Yarn1, async () => {
            const workspaceCli = workspace !== null
              ? [`workspace`, workspace]
              : [];

            // Makes sure that we'll be using Yarn 1.x
            const version = await execUtils.pipevp(`yarn`, [`set`, `version`, `classic`, `--only-if-needed`], {cwd, env, stdin, stdout, stderr, end: execUtils.EndStrategy.ErrorCode});
            if (version.code !== 0)
              return version.code;

            // Otherwise Yarn 1 will pack the .yarn directory :(
            await xfs.appendFilePromise(ppath.join(cwd, `.npmignore` as PortablePath), `/.yarn\n`);

            stdout.write(`\n`);

            // Run an install; we can't avoid it unless we inspect the
            // package.json, which I don't want to do to keep the codebase
            // clean (even if it has a slight perf cost when cloning v1 repos)
            const install = await execUtils.pipevp(`yarn`, [`install`], {cwd, env, stdin, stdout, stderr, end: execUtils.EndStrategy.ErrorCode});
            if (install.code !== 0)
              return install.code;

            stdout.write(`\n`);

            const pack = await execUtils.pipevp(`yarn`, [...workspaceCli, `pack`, `--filename`, npath.fromPortablePath(outputPath)], {cwd, env, stdin, stdout, stderr});
            if (pack.code !== 0)
              return pack.code;

            return 0;
          }],

          [PackageManager.Yarn2, async () => {
            const workspaceCli = workspace !== null
              ? [`workspace`, workspace]
              : [];

            // We enable inline builds, because nobody wants to
            // read a logfile telling them to open another logfile
            env.YARN_ENABLE_INLINE_BUILDS = `1`;

            // If a lockfile doesn't exist we create a empty one to
            // prevent the project root detection from thinking it's in an
            // undeclared workspace when the user has a lockfile in their home
            // directory on Windows
            const lockfilePath = ppath.join(cwd, Filename.lockfile);
            if (!(await xfs.existsPromise(lockfilePath)))
              await xfs.writeFilePromise(lockfilePath, ``);

            // Yarn 2 supports doing the install and the pack in a single command,
            // so we leverage that. We also don't need the "set version" call since
            // we're already operating within a Yarn 2 context (plus people should
            // really check-in their Yarn versions anyway).
            const pack = await execUtils.pipevp(`yarn`, [...workspaceCli, `pack`, `--install-if-needed`, `--filename`, npath.fromPortablePath(outputPath)], {cwd, env, stdin, stdout, stderr});
            if (pack.code !== 0)
              return pack.code;

            return 0;
          }],

          [PackageManager.Npm, async () => {
            if (workspace !== null)
              throw new Error(`Workspaces aren't supported by npm, which has been detected as the primary package manager for ${cwd}`);

            // Otherwise npm won't properly set the user agent, using the Yarn
            // one instead
            delete env.npm_config_user_agent;

            // We can't use `npm ci` because some projects don't have npm
            // lockfiles that are up-to-date. Hopefully npm won't decide
            // to change the versions randomly.
            const install = await execUtils.pipevp(`npm`, [`install`], {cwd, env, stdin, stdout, stderr, end: execUtils.EndStrategy.ErrorCode});
            if (install.code !== 0)
              return install.code;

            const packStream = new PassThrough();
            const packPromise = miscUtils.bufferStream(packStream);

            packStream.pipe(stdout);

            // It seems that npm doesn't support specifying the pack output path,
            // so we have to extract the stdout on top of forking it to the logs.
            const pack = await execUtils.pipevp(`npm`, [`pack`, `--silent`], {cwd, env, stdin, stdout: packStream, stderr});
            if (pack.code !== 0)
              return pack.code;

            const packOutput = (await packPromise).toString().trim();
            const packTarget = ppath.resolve(cwd, npath.toPortablePath(packOutput));

            // Only then can we move the pack to its rightful location
            await xfs.renamePromise(packTarget, outputPath);

            return 0;
          }],
        ]);

        const workflow = workflows.get(effectivePackageManager);
        if (typeof workflow === `undefined`)
          throw new Error(`Assertion failed: Unsupported workflow`);

        const code = await workflow();
        if (code === 0 || typeof code === `undefined`)
          return;

        xfs.detachTemp(logDir);
        throw new ReportError(MessageName.PACKAGE_PREPARATION_FAILED, `Packing the package failed (exit code ${code}, logs can be found here: ${logFile})`);
      });
    });
  });
}

type HasPackageScriptOption = {
  project: Project,
};

export async function hasPackageScript(locator: Locator, scriptName: string, {project}: HasPackageScriptOption) {
  // We can avoid using the linkers if the locator is a workspace
  const workspace = project.tryWorkspaceByLocator(locator);
  if (workspace !== null)
    return hasWorkspaceScript(workspace, scriptName);

  const pkg = project.storedPackages.get(locator.locatorHash);
  if (!pkg)
    throw new Error(`Package for ${structUtils.prettyLocator(project.configuration, locator)} not found in the project`);

  return await ZipOpenFS.openPromise(async (zipOpenFs: ZipOpenFS) => {
    const configuration = project.configuration;

    const linkers = project.configuration.getLinkers();
    const linkerOptions = {project, report: new StreamReport({stdout: new PassThrough(), configuration})};

    const linker = linkers.find(linker => linker.supportsPackage(pkg, linkerOptions));
    if (!linker)
      throw new Error(`The package ${structUtils.prettyLocator(project.configuration, pkg)} isn't supported by any of the available linkers`);

    const packageLocation = await linker.findPackageLocation(pkg, linkerOptions);
    const packageFs = new CwdFS(packageLocation, {baseFs: zipOpenFs});
    const manifest = await Manifest.find(PortablePath.dot, {baseFs: packageFs});

    return manifest.scripts.has(scriptName);
  }, {
    libzip: await getLibzipPromise(),
  });
}

type ExecutePackageScriptOptions = {
  cwd?: PortablePath | undefined,
  project: Project,
  stdin: Readable | null,
  stdout: Writable,
  stderr: Writable,
};

export async function executePackageScript(locator: Locator, scriptName: string, args: Array<string>, {cwd, project, stdin, stdout, stderr}: ExecutePackageScriptOptions): Promise<number> {
  return await xfs.mktempPromise(async binFolder => {
    const {manifest, env, cwd: realCwd} = await initializePackageEnvironment(locator, {project, binFolder, cwd, lifecycleScript: scriptName});

    const script = manifest.scripts.get(scriptName);
    if (typeof script === `undefined`)
      return 1;

    const realExecutor = async () => {
      return await execute(script, args, {cwd: realCwd, env, stdin, stdout, stderr});
    };

    const executor = await project.configuration.reduceHook(hooks => {
      return hooks.wrapScriptExecution;
    }, realExecutor, project, locator, scriptName, {
      script, args, cwd: realCwd, env, stdin, stdout, stderr,
    });

    return await executor();
  });
}

export async function executePackageShellcode(locator: Locator, command: string, args: Array<string>, {cwd, project, stdin, stdout, stderr}: ExecutePackageScriptOptions) {
  return await xfs.mktempPromise(async binFolder => {
    const {env, cwd: realCwd} = await initializePackageEnvironment(locator, {project, binFolder, cwd});

    return await execute(command, args, {cwd: realCwd, env, stdin, stdout, stderr});
  });
}

async function initializeWorkspaceEnvironment(workspace: Workspace, {binFolder, cwd, lifecycleScript}: {binFolder: PortablePath, cwd?: PortablePath | undefined, lifecycleScript?: string}) {
  const env = await makeScriptEnv({project: workspace.project, locator: workspace.anchoredLocator, binFolder, lifecycleScript});

  await Promise.all(
    Array.from(await getWorkspaceAccessibleBinaries(workspace), ([binaryName, [, binaryPath]]) =>
      makePathWrapper(binFolder, toFilename(binaryName), process.execPath, [binaryPath])
    )
  );

  // When operating under PnP, `initializePackageEnvironment`
  // yields package location to the linker, which goes into
  // the PnP hook, which resolves paths relative to dirname,
  // which is realpath'd (because of Node). The realpath that
  // follows ensures that workspaces are realpath'd in a
  // similar way.
  //
  // I'm not entirely comfortable with this, especially because
  // there are no tests pertaining to this behaviour and the use
  // case is still a bit fuzzy to me (something about Flow not
  // handling well the case where a project was 1:1 symlinked
  // into another place, I think?). I also don't like the idea
  // of realpathing thing in general, since it means losing
  // information...
  //
  // It's fine for now because it preserves a behaviour in 3.x
  // that was already there in 2.x, but it should be considered
  // for removal or standardization if it ever becomes a problem.
  //
  if (typeof cwd === `undefined`)
    cwd = ppath.dirname(await xfs.realpathPromise(ppath.join(workspace.cwd, `package.json` as Filename)));

  return {manifest: workspace.manifest, binFolder, env, cwd};
}

async function initializePackageEnvironment(locator: Locator, {project, binFolder, cwd, lifecycleScript}: {project: Project, binFolder: PortablePath, cwd?: PortablePath | undefined, lifecycleScript?: string}) {
  // We can avoid using the linkers if the locator is a workspace
  const workspace = project.tryWorkspaceByLocator(locator);
  if (workspace !== null)
    return initializeWorkspaceEnvironment(workspace, {binFolder, cwd, lifecycleScript});

  const pkg = project.storedPackages.get(locator.locatorHash);
  if (!pkg)
    throw new Error(`Package for ${structUtils.prettyLocator(project.configuration, locator)} not found in the project`);

  return await ZipOpenFS.openPromise(async (zipOpenFs: ZipOpenFS) => {
    const configuration = project.configuration;

    const linkers = project.configuration.getLinkers();
    const linkerOptions = {project, report: new StreamReport({stdout: new PassThrough(), configuration})};

    const linker = linkers.find(linker => linker.supportsPackage(pkg, linkerOptions));
    if (!linker)
      throw new Error(`The package ${structUtils.prettyLocator(project.configuration, pkg)} isn't supported by any of the available linkers`);

    const env = await makeScriptEnv({project, locator, binFolder, lifecycleScript});

    await Promise.all(
      Array.from(await getPackageAccessibleBinaries(locator, {project}), ([binaryName, [, binaryPath]]) =>
        makePathWrapper(binFolder, toFilename(binaryName), process.execPath, [binaryPath])
      )
    );

    const packageLocation = await linker.findPackageLocation(pkg, linkerOptions);
    const packageFs = new CwdFS(packageLocation, {baseFs: zipOpenFs});
    const manifest = await Manifest.find(PortablePath.dot, {baseFs: packageFs});

    if (typeof cwd === `undefined`)
      cwd = packageLocation;

    return {manifest, binFolder, env, cwd};
  }, {
    libzip: await getLibzipPromise(),
  });
}

type ExecuteWorkspaceScriptOptions = {
  cwd?: PortablePath | undefined,
  stdin: Readable | null,
  stdout: Writable,
  stderr: Writable,
};

export async function executeWorkspaceScript(workspace: Workspace, scriptName: string, args: Array<string>, {cwd, stdin, stdout, stderr}: ExecuteWorkspaceScriptOptions) {
  return await executePackageScript(workspace.anchoredLocator, scriptName, args, {cwd, project: workspace.project, stdin, stdout, stderr});
}

export function hasWorkspaceScript(workspace: Workspace, scriptName: string) {
  return workspace.manifest.scripts.has(scriptName);
}

type ExecuteWorkspaceLifecycleScriptOptions = {
  cwd?: PortablePath | undefined,
  report: Report,
};

export async function executeWorkspaceLifecycleScript(workspace: Workspace, lifecycleScriptName: string, {cwd, report}: ExecuteWorkspaceLifecycleScriptOptions) {
  const {configuration} = workspace.project;
  const stdin = null;

  await xfs.mktempPromise(async logDir => {
    const logFile = ppath.join(logDir, `${lifecycleScriptName}.log` as PortablePath);

    const header = `# This file contains the result of Yarn calling the "${lifecycleScriptName}" lifecycle script inside a workspace ("${workspace.cwd}")\n`;

    const {stdout, stderr} = configuration.getSubprocessStreams(logFile, {
      report,
      prefix: structUtils.prettyLocator(configuration, workspace.anchoredLocator),
      header,
    });

    report.reportInfo(MessageName.LIFECYCLE_SCRIPT, `Calling the "${lifecycleScriptName}" lifecycle script`);

    const exitCode = await executeWorkspaceScript(workspace, lifecycleScriptName, [], {cwd, stdin, stdout, stderr});

    stdout.end();
    stderr.end();

    if (exitCode !== 0) {
      xfs.detachTemp(logDir);

      throw new ReportError(MessageName.LIFECYCLE_SCRIPT, `${capitalize(lifecycleScriptName)} script failed (exit code ${formatUtils.pretty(configuration, exitCode, formatUtils.Type.NUMBER)}, logs can be found here: ${formatUtils.pretty(configuration, logFile, formatUtils.Type.PATH)}); run ${formatUtils.pretty(configuration, `yarn ${lifecycleScriptName}`, formatUtils.Type.CODE)} to investigate`);
    }
  });
}

export async function maybeExecuteWorkspaceLifecycleScript(workspace: Workspace, lifecycleScriptName: string, opts: ExecuteWorkspaceLifecycleScriptOptions) {
  if (hasWorkspaceScript(workspace, lifecycleScriptName)) {
    await executeWorkspaceLifecycleScript(workspace, lifecycleScriptName, opts);
  }
}

type GetPackageAccessibleBinariesOptions = {
  project: Project,
};

type Binary = [Locator, NativePath];
type PackageAccessibleBinaries = Map<string, Binary>;

/**
 * Return the binaries that can be accessed by the specified package
 *
 * @param locator The queried package
 * @param project The project owning the package
 */

export async function getPackageAccessibleBinaries(locator: Locator, {project}: GetPackageAccessibleBinariesOptions): Promise<PackageAccessibleBinaries> {
  const configuration = project.configuration;
  const binaries: PackageAccessibleBinaries = new Map();

  const pkg = project.storedPackages.get(locator.locatorHash);
  if (!pkg)
    throw new Error(`Package for ${structUtils.prettyLocator(configuration, locator)} not found in the project`);

  const stdout = new Writable();

  const linkers = configuration.getLinkers();
  const linkerOptions = {project, report: new StreamReport({configuration, stdout})};

  const visibleLocators: Set<LocatorHash> = new Set([locator.locatorHash]);

  for (const descriptor of pkg.dependencies.values()) {
    const resolution = project.storedResolutions.get(descriptor.descriptorHash);
    if (!resolution)
      throw new Error(`Assertion failed: The resolution (${structUtils.prettyDescriptor(configuration, descriptor)}) should have been registered`);

    visibleLocators.add(resolution);
  }

  const dependenciesWithBinaries = await Promise.all(Array.from(visibleLocators, async locatorHash => {
    const dependency = project.storedPackages.get(locatorHash);
    if (!dependency)
      throw new Error(`Assertion failed: The package (${locatorHash}) should have been registered`);

    if (dependency.bin.size === 0)
      return miscUtils.mapAndFilter.skip;

    const linker = linkers.find(linker => linker.supportsPackage(dependency, linkerOptions));
    if (!linker)
      return miscUtils.mapAndFilter.skip;

    let packageLocation: PortablePath | null = null;
    try {
      packageLocation = await linker.findPackageLocation(dependency, linkerOptions);
    } catch (err) {
      // Some packages may not be installed when they are incompatible
      // with the current system.
      if (err.code === `LOCATOR_NOT_INSTALLED`) {
        return miscUtils.mapAndFilter.skip;
      } else {
        throw err;
      }
    }

    return {dependency, packageLocation};
  }));

  // The order in which binaries overwrite each other must be stable
  for (const candidate of dependenciesWithBinaries) {
    if (candidate === miscUtils.mapAndFilter.skip)
      continue;

    const {dependency, packageLocation} = candidate;

    for (const [name, target] of dependency.bin) {
      binaries.set(name, [dependency, npath.fromPortablePath(ppath.resolve(packageLocation, target))]);
    }
  }

  return binaries;
}

/**
 * Return the binaries that can be accessed by the specified workspace
 *
 * @param workspace The queried workspace
 */

export async function getWorkspaceAccessibleBinaries(workspace: Workspace) {
  return await getPackageAccessibleBinaries(workspace.anchoredLocator, {project: workspace.project});
}

type ExecutePackageAccessibleBinaryOptions = {
  cwd: PortablePath,
  nodeArgs?: Array<string>,
  project: Project,
  stdin: Readable | null,
  stdout: Writable,
  stderr: Writable,
  /** @internal */
  packageAccessibleBinaries?: PackageAccessibleBinaries,
};

/**
 * Execute a binary from the specified package.
 *
 * Note that "binary" in this sense means "a Javascript file". Actual native
 * binaries cannot be executed this way, because we use Node in order to
 * transparently read from the archives.
 *
 * @param locator The queried package
 * @param binaryName The name of the binary file to execute
 * @param args The arguments to pass to the file
 */

export async function executePackageAccessibleBinary(locator: Locator, binaryName: string, args: Array<string>, {cwd, project, stdin, stdout, stderr, nodeArgs = [], packageAccessibleBinaries}: ExecutePackageAccessibleBinaryOptions) {
  packageAccessibleBinaries ??= await getPackageAccessibleBinaries(locator, {project});

  const binary = packageAccessibleBinaries.get(binaryName);
  if (!binary)
    throw new Error(`Binary not found (${binaryName}) for ${structUtils.prettyLocator(project.configuration, locator)}`);

  return await xfs.mktempPromise(async binFolder => {
    const [, binaryPath] = binary;
    const env = await makeScriptEnv({project, locator, binFolder});

    await Promise.all(
      Array.from(packageAccessibleBinaries!, ([binaryName, [, binaryPath]]) =>
        makePathWrapper(env.BERRY_BIN_FOLDER as PortablePath, toFilename(binaryName), process.execPath, [binaryPath])
      )
    );

    let result;
    try {
      result = await execUtils.pipevp(process.execPath, [...nodeArgs, binaryPath, ...args], {cwd, env, stdin, stdout, stderr});
    } finally {
      await xfs.removePromise(env.BERRY_BIN_FOLDER as PortablePath);
    }

    return result.code;
  });
}

type ExecuteWorkspaceAccessibleBinaryOptions = {
  cwd: PortablePath,
  stdin: Readable | null,
  stdout: Writable,
  stderr: Writable,
  /** @internal */
  packageAccessibleBinaries?: PackageAccessibleBinaries,
};

/**
 * Execute a binary from the specified workspace
 *
 * @param workspace The queried package
 * @param binaryName The name of the binary file to execute
 * @param args The arguments to pass to the file
 */

export async function executeWorkspaceAccessibleBinary(workspace: Workspace, binaryName: string, args: Array<string>, {cwd, stdin, stdout, stderr, packageAccessibleBinaries}: ExecuteWorkspaceAccessibleBinaryOptions) {
  return await executePackageAccessibleBinary(workspace.anchoredLocator, binaryName, args, {project: workspace.project, cwd, stdin, stdout, stderr, packageAccessibleBinaries});
}
