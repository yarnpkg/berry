import execa = require('execa');

import {Readable, Writable} from 'stream';

export type ExecOptions = {
  cwd: string,
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
};

export async function execFile(fileName: string, args: Array<string>, {cwd, stdin, stdout, stderr}: ExecOptions) {
  const stdio: Array<any> = [`pipe`, `pipe`, `pipe`];

  if (stdin === process.stdin)
    stdio[0] = stdin;
  if (stdout === process.stdout)
    stdio[1] = stdout;
  if (stderr === process.stderr)
    stdio[2] = stderr;

  const subprocess = execa(fileName, args, {stdio, cwd});

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
