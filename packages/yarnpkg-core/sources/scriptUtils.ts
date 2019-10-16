import {CwdFS, Filename, NativePath, PortablePath, ZipOpenFS} from '@yarnpkg/fslib';
import {xfs, npath, ppath, toFilename}                        from '@yarnpkg/fslib';
import {execute}                                              from '@yarnpkg/shell';
import {PassThrough, Readable, Writable}                      from 'stream';
import {dirSync}                                              from 'tmp';

import {Configuration}                                        from './Configuration';
import {Manifest}                                             from './Manifest';
import {Project}                                              from './Project';
import {MessageName, ReportError, Report}                     from './Report';
import {StreamReport}                                         from './StreamReport';
import {Workspace}                                            from './Workspace';
import * as execUtils                                         from './execUtils';
import * as miscUtils                                         from './miscUtils';
import * as structUtils                                       from './structUtils';
import {LocatorHash, Locator}                                 from './types';

async function makePathWrapper(location: PortablePath, name: Filename, argv0: NativePath, args: Array<string> = []) {
  if (process.platform === `win32`) {
    await xfs.writeFilePromise(ppath.format({dir: location, name, ext: '.cmd'}), `@"${argv0}" ${args.join(` `)} %*\n`);
  } else {
    await xfs.writeFilePromise(ppath.join(location, name), `#!/bin/sh\nexec "${argv0}" ${args.map(arg => `'${arg.replace(/'/g, `'"'"'`)}'`).join(` `)} "$@"\n`);
    await xfs.chmodPromise(ppath.join(location, name), 0o755);
  }
}

export async function makeScriptEnv({project, lifecycleScript}: {project?: Project, lifecycleScript?: string} = {}) {
  const scriptEnv: {[key: string]: string} = {};
  for (const [key, value] of Object.entries(process.env))
    if (typeof value !== `undefined`)
      scriptEnv[key.toLowerCase() !== `path` ? key : `PATH`] = value;

  const nativeBinFolder = dirSync().name;
  const binFolder = npath.toPortablePath(nativeBinFolder);

  // We expose the base folder in the environment so that we can later add the
  // binaries for the dependencies of the active package
  scriptEnv.BERRY_BIN_FOLDER = nativeBinFolder;

  // Register some binaries that must be made available in all subprocesses
  // spawned by Yarn (we thus ensure that they always use the right version)
  await makePathWrapper(binFolder, toFilename(`run`), process.execPath, [process.argv[1], `run`]);
  await makePathWrapper(binFolder, toFilename(`yarn`), process.execPath, [process.argv[1]]);
  await makePathWrapper(binFolder, toFilename(`yarnpkg`), process.execPath, [process.argv[1]]);
  await makePathWrapper(binFolder, toFilename(`node`), process.execPath);
  await makePathWrapper(binFolder, toFilename(`node-gyp`), process.execPath, [process.argv[1], `run`, `--top-level`, `node-gyp`]);

  scriptEnv.PATH = scriptEnv.PATH
    ? `${nativeBinFolder}${npath.delimiter}${scriptEnv.PATH}`
    : `${nativeBinFolder}`;

  scriptEnv.npm_execpath = `${nativeBinFolder}${npath.sep}yarn`;
  scriptEnv.npm_node_execpath = `${nativeBinFolder}${npath.sep}node`;

  const version = typeof YARN_VERSION !== `undefined`
    ? `yarn/${YARN_VERSION}`
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

export async function prepareExternalProject(cwd: PortablePath, outputPath: PortablePath, {configuration, report}: {configuration: Configuration, report: Report}) {
  const env = await makeScriptEnv();

  {
    const stdin = null;
    const {logFile, stdout, stderr} = configuration.getSubprocessStreams(cwd, {report});

    const {code} = await execUtils.pipevp(`yarn`, [`install`], {cwd, env, stdin, stdout, stderr});
    if (code !== 0) {
      throw new ReportError(MessageName.PACKAGE_PREPARATION_FAILED, `Installing the package dependencies failed (exit code ${code}, logs can be found here: ${logFile})`);
    }
  }

  {
    const stdin = null;
    const {logFile, stdout, stderr} = configuration.getSubprocessStreams(cwd, {report});

    const {code} = await execUtils.pipevp(`yarn`, [`pack`, `--filename`, npath.fromPortablePath(outputPath)], {cwd, env, stdin, stdout, stderr});
    if (code !== 0) {
      throw new ReportError(MessageName.PACKAGE_PREPARATION_FAILED, `Packing the package failed (exit code ${code}, logs can be found here: ${logFile})`);
    }
  }
}

type HasPackageScriptOption = {
  project: Project,
};

export async function hasPackageScript(locator: Locator, scriptName: string, {project}: HasPackageScriptOption) {
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
  });
}

type ExecutePackageScriptOptions = {
  cwd?: PortablePath | undefined,
  project: Project,
  stdin: Readable | null,
  stdout: Writable,
  stderr: Writable,
};

export async function executePackageScript(locator: Locator, scriptName: string, args: Array<string>, {cwd, project, stdin, stdout, stderr}: ExecutePackageScriptOptions) {
  const {manifest, binFolder, env, cwd: realCwd} = await initializePackageEnvironment(locator, {project, cwd, lifecycleScript: scriptName});

  const script = manifest.scripts.get(scriptName);
  if (!script)
    return;

  const realExecutor = async () => {
    return await execute(script, args, {cwd: realCwd, env, stdin, stdout, stderr});
  };

  const executor = await project.configuration.reduceHook(hooks => {
    return hooks.wrapScriptExecution;
  }, realExecutor, project, locator, scriptName, {
    script, args, cwd: realCwd, env, stdin, stdout, stderr,
  });

  try {
    return await executor();
  } finally {
    await xfs.removePromise(binFolder);
  }
}

export async function executePackageShellcode(locator: Locator, command: string, args: Array<string>, {cwd, project, stdin, stdout, stderr}: ExecutePackageScriptOptions) {
  const {binFolder, env, cwd: realCwd} = await initializePackageEnvironment(locator, {project, cwd});

  try {
    return await execute(command, args, {cwd: realCwd, env, stdin, stdout, stderr});
  } finally {
    await xfs.removePromise(binFolder);
  }
}

async function initializePackageEnvironment(locator: Locator, {project, cwd, lifecycleScript}: {project: Project, cwd?: PortablePath | undefined, lifecycleScript?: string}) {
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

    const env = await makeScriptEnv({project, lifecycleScript});
    const binFolder = npath.toPortablePath(env.BERRY_BIN_FOLDER);

    for (const [binaryName, [, binaryPath]] of await getPackageAccessibleBinaries(locator, {project}))
      await makePathWrapper(binFolder, toFilename(binaryName), process.execPath, [binaryPath]);

    const packageLocation = await linker.findPackageLocation(pkg, linkerOptions);
    const packageFs = new CwdFS(packageLocation, {baseFs: zipOpenFs});
    const manifest = await Manifest.find(PortablePath.dot, {baseFs: packageFs});

    if (typeof cwd === `undefined`)
      cwd = packageLocation;

    return {manifest, binFolder, env, cwd};
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

export async function hasWorkspaceScript(workspace: Workspace, scriptName: string) {
  return await hasPackageScript(workspace.anchoredLocator, scriptName, {project: workspace.project});
}

type GetPackageAccessibleBinariesOptions = {
  project: Project,
};

/**
 * Return the binaries that can be accessed by the specified package
 *
 * @param locator The queried package
 * @param project The project owning the package
 */

export async function getPackageAccessibleBinaries(locator: Locator, {project}: GetPackageAccessibleBinariesOptions) {
  const configuration = project.configuration;
  const binaries: Map<string, [Locator, NativePath]> = new Map();

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

  for (const locatorHash of visibleLocators) {
    const dependency = project.storedPackages.get(locatorHash);
    if (!dependency)
      throw new Error(`Assertion failed: The package (${locatorHash}) should have been registered`);

    if (dependency.bin.size === 0)
      continue;

    const linker = linkers.find(linker => linker.supportsPackage(dependency, linkerOptions));
    if (!linker)
      continue;

    const packageLocation = await linker.findPackageLocation(dependency, linkerOptions);

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
  project: Project,
  stdin: Readable | null,
  stdout: Writable,
  stderr: Writable,
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

export async function executePackageAccessibleBinary(locator: Locator, binaryName: string, args: Array<string>, {cwd, project, stdin, stdout, stderr}: ExecutePackageAccessibleBinaryOptions) {
  const packageAccessibleBinaries = await getPackageAccessibleBinaries(locator, {project});

  const binary = packageAccessibleBinaries.get(binaryName);
  if (!binary)
    throw new Error(`Binary not found (${binaryName}) for ${structUtils.prettyLocator(project.configuration, locator)}`);

  const [, binaryPath] = binary;
  const env = await makeScriptEnv({project});

  for (const [binaryName, [, binaryPath]] of packageAccessibleBinaries)
    await makePathWrapper(env.BERRY_BIN_FOLDER as PortablePath, toFilename(binaryName), process.execPath, [binaryPath]);

  let result;
  try {
    result = await execUtils.pipevp(process.execPath, [binaryPath, ...args], {cwd, env, stdin, stdout, stderr});
  } finally {
    await xfs.removePromise(env.BERRY_BIN_FOLDER as PortablePath);
  }

  return result.code;
}

type ExecuteWorkspaceAccessibleBinaryOptions = {
  cwd: PortablePath,
  stdin: Readable | null,
  stdout: Writable,
  stderr: Writable,
};

/**
 * Execute a binary from the specified workspace
 *
 * @param workspace The queried package
 * @param binaryName The name of the binary file to execute
 * @param args The arguments to pass to the file
 */

export async function executeWorkspaceAccessibleBinary(workspace: Workspace, binaryName: string, args: Array<string>, {cwd, stdin, stdout, stderr}: ExecuteWorkspaceAccessibleBinaryOptions) {
  return await executePackageAccessibleBinary(workspace.anchoredLocator, binaryName, args, {project: workspace.project, cwd, stdin, stdout, stderr});
}
