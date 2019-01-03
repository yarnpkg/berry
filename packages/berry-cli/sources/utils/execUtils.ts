import {Project}                      from '@berry/core';
import execa                          from 'execa';
import {chmod, existsSync, writeFile} from 'fs';
import {delimiter}                    from 'path';
import {Readable, Writable}           from 'stream';
import {dirSync}                      from 'tmp';
import {promisify}                    from 'util';

const chmodP = promisify(chmod);
const writeFileP = promisify(writeFile);

export type ExecOptions = {
  cwd: string,
  env?: {[key: string]: string | undefined},
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
  paths?: Array<string>,
};

export async function execFile(fileName: string, args: Array<string>, {cwd, env = process.env, stdin, stdout, stderr, paths = []}: ExecOptions) {
  const stdio: Array<any> = [`pipe`, `pipe`, `pipe`];

  if (stdin === process.stdin)
    stdio[0] = stdin;
  if (stdout === process.stdout)
    stdio[1] = stdout;
  if (stderr === process.stderr)
    stdio[2] = stderr;

  const nextEnv: {[key: string]: string} = {};

  for (const key of Object.keys(env))
    nextEnv[key.toUpperCase()] = env[key] as string;

  if (paths.length > 0)
    nextEnv.PATH = nextEnv.PATH
      ? `${paths.join(delimiter)}${delimiter}${nextEnv.PATH}`
      : `${paths.join(delimiter)}`;

  const subprocess = execa(fileName, args, {stdio, cwd, env: nextEnv});

  if (stdin !== process.stdin)
    stdin.pipe(subprocess.stdin);
  if (stdout !== process.stdout)
    subprocess.stdout.pipe(stdout);
  if (stderr !== process.stderr)
    subprocess.stderr.pipe(stderr);

  try {
    await subprocess;
  } catch (error) {
    return 1;
  }

  return 0;
}

export async function makePathWrapper(name: string, argv0: string, args: Array<string> = []) {
  const pathWrapper = dirSync().name;

  if (process.platform === `win32`) {
    await writeFileP(`${pathWrapper}/${name}.cmd`, `@"${pathWrapper}\\${name}.cmd" ${args.join(` `)} %*\n`);
  } else {
    await writeFileP(`${pathWrapper}/${name}`, `#!/usr/bin/env bash\n"${argv0}" ${args.map(arg => `'${arg.replace(/'/g, `'"'"'`)}'`).join(` `)} "$@"\n`);
    await chmodP(`${pathWrapper}/${name}`, 0o755);
  }

  return pathWrapper;
}

export async function makeExecEnv(project: Project) {
  const nextEnv = {... process.env};

  // Register some binaries that must be made available in all subprocesses
  // spawned by Berry

  const paths = [
    await makePathWrapper(`run`, process.execPath, [process.argv[1], `run`]),
    await makePathWrapper(`berry`, process.execPath, [process.argv[1]]),
    await makePathWrapper(`node`, process.execPath),
  ];

  nextEnv.PATH = nextEnv.PATH
    ? `${paths.join(delimiter)}${delimiter}${nextEnv.PATH}`
    : `${paths.join(delimiter)}`;

  // Add the .pnp.js file to the Node options, so that we're sure that PnP will
  // be correctly setup

  const pnpPath = `${project.cwd}/.pnp.js`;

  if (existsSync(pnpPath))
    nextEnv.NODE_OPTIONS = `--require ${pnpPath} ${nextEnv.NODE_OPTIONS || ''}`;

  return nextEnv;
}
