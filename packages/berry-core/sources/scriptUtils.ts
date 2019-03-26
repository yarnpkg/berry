import {CwdFS, ZipOpenFS, xfs, NodeFS}   from '@berry/fslib';
import {execute}                         from '@berry/shell';
import {delimiter, posix}                from 'path';
import {PassThrough, Readable, Writable} from 'stream';
import {dirSync}                         from 'tmp';

import {Manifest}                        from './Manifest';
import {Project}                         from './Project';
import {StreamReport}                    from './StreamReport';
import {Workspace}                       from './Workspace';
import * as execUtils                    from './execUtils';
import * as structUtils                  from './structUtils';
import {Locator}                         from './types';

async function makePathWrapper(location: string, name: string, argv0: string, args: Array<string> = []) {
  if (process.platform === `win32`) {
    await xfs.writeFilePromise(`${location}/${name}.cmd`, `"${argv0}" ${args.join(` `)} %*\n`);
  } else {
    await xfs.writeFilePromise(`${location}/${name}`, `#!/usr/bin/env bash\nexec "${argv0}" ${args.map(arg => `'${arg.replace(/'/g, `'"'"'`)}'`).join(` `)} "$@"\n`);
    await xfs.chmodPromise(`${location}/${name}`, 0o755);
  }
}

export async function makeScriptEnv(project: Project) {
  const scriptEnv: {[key: string]: string} = {};
  for (const key of Object.keys(process.env))
    scriptEnv[key.toUpperCase()] = process.env[key] as string;

  const binFolder = scriptEnv.BERRY_BIN_FOLDER = dirSync().name;

  // Register some binaries that must be made available in all subprocesses
  // spawned by Yarn

  await makePathWrapper(binFolder, `run`, process.execPath, [process.argv[1], `run`]);
  await makePathWrapper(binFolder, `yarn`, process.execPath, [process.argv[1]]);
  await makePathWrapper(binFolder, `yarnpkg`, process.execPath, [process.argv[1]]);
  await makePathWrapper(binFolder, `node`, process.execPath);
  await makePathWrapper(binFolder, `node-gyp`, process.execPath, [process.argv[1], `run`, `--top-level`, `node-gyp`]);

  scriptEnv.PATH = scriptEnv.PATH
    ? `${binFolder}${delimiter}${scriptEnv.PATH}`
    : `${binFolder}`;

  // Add the .pnp.js file to the Node options, so that we're sure that PnP will
  // be correctly setup

  const pnpPath = NodeFS.fromPortablePath(`${project.cwd}/.pnp.js`);
  const pnpRequire = `--require ${pnpPath}`;

  if (xfs.existsSync(pnpPath)) {
    let nodeOptions = scriptEnv.NODE_OPTIONS || ``;

    nodeOptions = nodeOptions.replace(/\s*--require\s+\S*\.pnp\.js\s*/g, ` `).trim();
    nodeOptions = nodeOptions ? `${pnpRequire} ${nodeOptions}` : pnpRequire;

    scriptEnv.NODE_OPTIONS = nodeOptions;
  }

  return scriptEnv as (typeof scriptEnv) & {BERRY_BIN_FOLDER: string};
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
    const manifest = await Manifest.find(`.`, {baseFs: packageFs});

    return manifest.scripts.has(scriptName);
  });
}

type ExecutePackageScriptOptions = {
  cwd?: string | undefined,
  project: Project,
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
};

export async function executePackageScript(locator: Locator, scriptName: string, args: Array<string>, {cwd, project, stdin, stdout, stderr}: ExecutePackageScriptOptions) {
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

    const env = await makeScriptEnv(project);
    const binFolder = env.BERRY_BIN_FOLDER;

    for (const [binaryName, [pkg, binaryPath]] of await getPackageAccessibleBinaries(locator, {project}))
      await makePathWrapper(binFolder, binaryName, process.execPath, [binaryPath]);

    const packageLocation = await linker.findPackageLocation(pkg, linkerOptions);
    const packageFs = new CwdFS(packageLocation, {baseFs: zipOpenFs});
    const manifest = await Manifest.find(`.`, {baseFs: packageFs});

    if (typeof cwd === `undefined`)
      cwd = packageLocation;

    const script = manifest.scripts.get(scriptName);
    if (!script)
      return;

    try {
      return await execute(script, args, {cwd, env, stdin, stdout, stderr});
    } finally {
      await xfs.removePromise(binFolder);
    }
  });
}

type ExecuteWorkspaceScriptOptions = {
  cwd?: string | undefined,
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
};

export async function executeWorkspaceScript(workspace: Workspace, scriptName: string, args: Array<string>, {cwd, stdin, stdout, stderr}: ExecuteWorkspaceScriptOptions) {
  return await executePackageScript(workspace.anchoredLocator, scriptName, args, {cwd, project: workspace.project, stdin, stdout, stderr});
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
  const pkg = project.storedPackages.get(locator.locatorHash);

  if (!pkg)
    throw new Error(`Package for ${structUtils.prettyLocator(project.configuration, locator)} not found in the project`);

  return await ZipOpenFS.openPromise(async (zipOpenFs: ZipOpenFS) => {
    const configuration = project.configuration;
    const stdout = new Writable();

    const linkers = project.configuration.getLinkers();
    const linkerOptions = {project, report: new StreamReport({ configuration, stdout })};

    const binaries: Map<string, [Locator, string]> = new Map();

    const descriptors = [
      ... pkg.dependencies.values(),
      ... pkg.peerDependencies.values(),
    ];

    for (const descriptor of descriptors) {
      const resolution = project.storedResolutions.get(descriptor.descriptorHash);
      if (!resolution)
        continue;

      const pkg = project.storedPackages.get(resolution);
      if (!pkg)
        continue;

      const linker = linkers.find(linker => linker.supportsPackage(pkg, linkerOptions));
      if (!linker)
        continue;

      const packageLocation = await linker.findPackageLocation(pkg, linkerOptions);
      const packageFs = new CwdFS(packageLocation, {baseFs: zipOpenFs});
      const manifest = await Manifest.find(`.`, {baseFs: packageFs});

      for (const [binName, file] of manifest.bin.entries()) {
        const physicalPath = NodeFS.fromPortablePath(posix.resolve(packageLocation, file));
        binaries.set(binName, [pkg, physicalPath]);
      }
    }

    return binaries;
  });
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
  cwd: string,
  project: Project,
  stdin: Readable,
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

  const [pkg, binaryPath] = binary;
  const env = await makeScriptEnv(project);

  for (const [binaryName, [pkg, binaryPath]] of packageAccessibleBinaries)
    await makePathWrapper(env.BERRY_BIN_FOLDER, binaryName, process.execPath, [binaryPath]);

  try {
    await execUtils.execFile(process.execPath, [binaryPath, ... args], {cwd, env, stdin, stdout, stderr});
  } finally {
    await xfs.removePromise(env.BERRY_BIN_FOLDER);
  }
}

type ExecuteWorkspaceAccessibleBinaryOptions = {
  cwd: string,
  stdin: Readable,
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
