import execa = require('execa');

import {chmod, writeFile}   from 'fs';
import {delimiter}          from 'path';
import {Readable, Writable} from 'stream';
import {dirSync}            from 'tmp';
import {promisify}          from 'util';

const chmodP = promisify(chmod);
const writeFileP = promisify(writeFile);

export type ExecOptions = {
  cwd: string,
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
  paths?: Array<string>,
};

export async function execFile(fileName: string, args: Array<string>, {cwd, stdin, stdout, stderr, paths = []}: ExecOptions) {
  const stdio: Array<any> = [`pipe`, `pipe`, `pipe`];

  if (stdin === process.stdin)
    stdio[0] = stdin;
  if (stdout === process.stdout)
    stdio[1] = stdout;
  if (stderr === process.stderr)
    stdio[2] = stderr;

  const env: {[key: string]: string} = {};

  for (const key of Object.keys(process.env))
    env[key.toUpperCase()] = process.env[key] as string;

  if (paths.length > 0)
    env.PATH = env.PATH
      ? `${paths.join(delimiter)}${delimiter}${env.PATH}`
      : `${paths.join(delimiter)}`;

  const subprocess = execa(fileName, args, {stdio, cwd, env});

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

export async function execScript(scriptName: string, args: Array<string>, opts: ExecOptions) {
  return await execFile(process.execPath, [`--`, scriptName, ... args], opts);
}

export async function execSelf(args: Array<string>, opts: ExecOptions) {
  return await execScript(process.argv[1], args, opts);
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
