import {runShell}           from '@berry/shell';
import {FakeFS, NodeFS}     from '@berry/zipfs';
import {chmod, writeFile}   from 'fs-extra';
import {existsSync}         from 'fs';
import {delimiter, resolve} from 'path';
import {Readable, Writable} from 'stream';
import {dirSync}            from 'tmp';

import {Cache}              from './Cache';
import {Manifest}           from './Manifest';
import {Project}            from './Project';
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
  cache: Cache,
  project: Project,
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
};

export async function executePackageScript(locator: Locator, scriptName: string, args: Array<string>, {cache, project, stdin, stdout, stderr}: ExecutePackageScriptOptions) {
  const fetcher = project.configuration.makeFetcher();
  const fetcherOptions = {readOnly: true, rootFs: new NodeFS(), cache, fetcher, project};

  const packageFs = await fetcher.fetch(locator, fetcherOptions);
  const manifest = await Manifest.fromFile(`package.json`, {baseFs: packageFs});

  const script = manifest.scripts.get(scriptName);
  if (script === undefined)
    return;

  const cwd = packageFs.getRealPath();
  const env = await makeScriptEnv(project);

  await runShell(script, {args, cwd, env, stdin, stdout, stderr});
}

type ExecuteWorkspaceScriptOptions = {
  cache: Cache,
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
};

export async function executeWorkspaceScript(workspace: Workspace, scriptName: string, args: Array<string>, {cache, stdin, stdout, stderr}: ExecuteWorkspaceScriptOptions) {
  return await executePackageScript(workspace.anchoredLocator, scriptName, args, {project: workspace.project, cache, stdin, stdout, stderr});
}

type GetPackageAccessibleBinariesOptions = {
  cache: Cache,
  project: Project,
};

export async function getPackageAccessibleBinaries(locator: Locator, {cache, project}: GetPackageAccessibleBinariesOptions) {
  const pkg = project.storedPackages.get(locator.locatorHash);

  if (!pkg)
    throw new Error(`Package for ${structUtils.prettyLocator(project.configuration, locator)} not found in the project`);

  const fetcher = project.configuration.makeFetcher();
  const fetcherOptions = {readOnly: true, rootFs: new NodeFS(), cache, fetcher, project};

  const binaries: Map<string, [Locator, FakeFS, string]> = new Map();

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

    const packageFs = await fetcher.fetch(pkg, fetcherOptions);
    const manifest = await Manifest.fromFile(`package.json`, {baseFs: packageFs});

    for (const [binName, file] of manifest.bin.entries()) {
      binaries.set(binName, [pkg, packageFs, file]);
    }
  }

  return binaries;
}

type GetWorkspaceAccessibleBinariesOptions = {
  cache: Cache,
};

export async function getWorkspaceAccessibleBinaries(workspace: Workspace, {cache}: GetWorkspaceAccessibleBinariesOptions) {
  return await getPackageAccessibleBinaries(workspace.anchoredLocator, {project: workspace.project, cache});
}

type ExecutePackageAccessibleBinaryOptions = {
  cache: Cache,
  project: Project,
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
};

export async function executePackageAccessibleBinary(locator: Locator, binaryName: string, args: Array<string>, {cache, project, stdin, stdout, stderr}: ExecutePackageAccessibleBinaryOptions) {
  const packageAccessibleBinaries = await getPackageAccessibleBinaries(locator, {cache, project});
  const binary = packageAccessibleBinaries.get(binaryName);

  if (!binary)
    throw new Error(`Binary not found (${binaryName}) for ${structUtils.prettyLocator(project.configuration, locator)}`);

  const cwd = process.cwd();
  const env = await makeScriptEnv(project);

  const [pkg, packageFs, file] = binary;
  const target = resolve(packageFs.getRealPath(), file);

  return await execUtils.execFile(process.execPath, [target, ... args], {cwd, env, stdin, stdout, stderr});
}

type ExecuteWorkspaceAccessibleBinaryOptions = {
  cache: Cache,
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
};

export async function executeWorkspaceAccessibleBinary(workspace: Workspace, binaryName: string, args: Array<string>, {cache, stdin, stdout, stderr}: ExecuteWorkspaceAccessibleBinaryOptions) {
  return await executePackageAccessibleBinary(workspace.anchoredLocator, binaryName, args, {project: workspace.project, cache, stdin, stdout, stderr});
}
