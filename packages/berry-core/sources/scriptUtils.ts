import {runShell}                         from '@berry/shell';
import {CwdFS, FakeFS, NodeFS, ZipOpenFS} from '@berry/zipfs';
import {chmod, writeFile}   from 'fs-extra';
import {existsSync}         from 'fs';
import {delimiter, resolve, posix} from 'path';
import {PassThrough, Readable, Writable} from 'stream';
import {dirSync}            from 'tmp';

import {Cache}              from './Cache';
import {Manifest}           from './Manifest';
import {Project}            from './Project';
import {StreamReport}       from './StreamReport';
import {Workspace}          from './Workspace';
import * as execUtils       from './execUtils';
import * as structUtils     from './structUtils';
import {Locator}            from './types';

async function makePathWrapper(name: string, argv0: string, args: Array<string> = []) {
  const pathWrapper = dirSync().name;

  if (process.platform === `win32`) {
    await writeFile(`${pathWrapper}/${name}.cmd`, `@"${pathWrapper}\\${name}.cmd" ${args.join(` `)} %*\n`);
  } else {
    await writeFile(`${pathWrapper}/${name}`, `#!/usr/bin/env bash\n"${argv0}" ${args.map(arg => `'${arg.replace(/'/g, `'"'"'`)}'`).join(` `)} "$@"\n`);
    await chmod(`${pathWrapper}/${name}`, 0o755);
  }

  return pathWrapper;
}

export async function makeScriptEnv(project: Project) {
  const scriptEnv = {... process.env};

  // Register some binaries that must be made available in all subprocesses
  // spawned by Berry

  const paths = [
    await makePathWrapper(`run`, process.execPath, [process.argv[1], `run`]),
    await makePathWrapper(`berry`, process.execPath, [process.argv[1]]),
    await makePathWrapper(`node`, process.execPath),
  ];

  scriptEnv.PATH = scriptEnv.PATH
    ? `${paths.join(delimiter)}${delimiter}${scriptEnv.PATH}`
    : `${paths.join(delimiter)}`;

  // Add the .pnp.js file to the Node options, so that we're sure that PnP will
  // be correctly setup

  const pnpPath = `${project.cwd}/.pnp.js`;

  if (existsSync(pnpPath))
    scriptEnv.NODE_OPTIONS = `--require ${pnpPath} ${scriptEnv.NODE_OPTIONS || ''}`;

  return scriptEnv;
}

type ExecutePackageScriptOptions = {
  project: Project,
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
};

export async function executePackageScript(locator: Locator, scriptName: string, args: Array<string>, {project, stdin, stdout, stderr}: ExecutePackageScriptOptions) {
  const pkg = project.storedPackages.get(locator.locatorHash);

  if (!pkg)
    throw new Error(`Package for ${structUtils.prettyLocator(project.configuration, locator)} not found in the project`);

  return await ZipOpenFS.openPromise(async (zipOpenFs: ZipOpenFS) => {
    const configuration = project.configuration;

    const linkers = project.configuration.getLinkers();
    const linkerOptions = {project, report: new StreamReport({stdout: new PassThrough(), configuration})};

    const linker = linkers.find(linker => linker.supports(pkg, linkerOptions));
    if (!linker)
      throw new Error(`The package ${structUtils.prettyLocator(project.configuration, pkg)} isn't supported by any of the available linkers`);

    const packageLocation = await linker.findPackage(pkg, linkerOptions);

    const cwd = packageLocation;
    const env = await makeScriptEnv(project);

    const packageFs = new CwdFS(packageLocation, {baseFs: zipOpenFs});
    const manifest = await Manifest.find(`.`, {baseFs: packageFs});

    const script = manifest.scripts.get(scriptName);
    if (!script)
      return;

    await runShell(script, {args, cwd, env, stdin, stdout, stderr});
  });
}

type ExecuteWorkspaceScriptOptions = {
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
};

export async function executeWorkspaceScript(workspace: Workspace, scriptName: string, args: Array<string>, {stdin, stdout, stderr}: ExecuteWorkspaceScriptOptions) {
  return await executePackageScript(workspace.anchoredLocator, scriptName, args, {project: workspace.project, stdin, stdout, stderr});
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
      
      const linker = linkers.find(linker => linker.supports(pkg, linkerOptions));
      if (!linker)
        continue;
      
      const packageLocation = await linker.findPackage(pkg, linkerOptions);
      
      const packageFs = new CwdFS(packageLocation, {baseFs: zipOpenFs});
      const manifest = await Manifest.find(`.`, {baseFs: packageFs});
  
      for (const [binName, file] of manifest.bin.entries()) {
        binaries.set(binName, [pkg, posix.resolve(packageLocation, file)]);
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

  await execUtils.execFile(process.execPath, [binaryPath, ... args], {cwd, env, stdin, stdout, stderr});
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
