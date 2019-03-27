import {NodeFS}             from '@berry/fslib';
import crossSpawn           from 'cross-spawn';
import {Readable, Writable} from 'stream';

export type PipevpOptions = {
  cwd: string,
  env?: {[key: string]: string | undefined},
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
};

export async function pipevp(fileName: string, args: Array<string>, {cwd, env = process.env, stdin, stdout, stderr}: PipevpOptions) {
  const stdio: Array<any> = [`pipe`, `pipe`, `pipe`];

  if (stdin === process.stdin)
    stdio[0] = stdin;
  if (stdout === process.stdout)
    stdio[1] = stdout;
  if (stderr === process.stderr)
    stdio[2] = stderr;

  const subprocess = crossSpawn(fileName, args, {
    cwd: NodeFS.fromPortablePath(cwd),
    env,
    stdio,
  });

  if (stdin !== process.stdin)
    stdin.pipe(subprocess.stdin);
  if (stdout !== process.stdout)
    subprocess.stdout.pipe(stdout);
  if (stderr !== process.stderr)
    subprocess.stderr.pipe(stderr);

  await subprocess;
}

export type ExecvpOptions = {
  cwd: string,
  env?: {[key: string]: string | undefined},
  encoding?: string,
};

export async function execvp(fileName: string, args: Array<string>, opts: ExecvpOptions & {encoding: `buffer`}): Promise<{code: number, stdout: Buffer, stderr: Buffer}>;
export async function execvp(fileName: string, args: Array<string>, opts: ExecvpOptions & {encoding: string}): Promise<{code: number, stdout: string, stderr: string}>;
export async function execvp(fileName: string, args: Array<string>, opts: ExecvpOptions): Promise<{code: number, stdout: string, stderr: string}>;

export async function execvp(fileName: string, args: Array<string>, {cwd, env = process.env, encoding = `utf8`}: ExecvpOptions) {
  const stdio: any = [`ignore`, `pipe`, `pipe`];

  const stdoutChunks: Array<Buffer> = [];
  const stderrChunks: Array<Buffer> = [];

  const subprocess = crossSpawn(fileName, args, {
    cwd: NodeFS.fromPortablePath(cwd),
    env,
    stdio,
  });

  subprocess.stdout.on(`data`, (chunk: Buffer) => {
    stdoutChunks.push(chunk);
  });

  subprocess.stderr.on(`data`, (chunk: Buffer) => {
    stderrChunks.push(chunk)
  })

  return await new Promise((resolve, reject) => {
    subprocess.on(`close`, (code: number) => {
      const stdout = encoding === `buffer`
        ? Buffer.concat(stdoutChunks)
        : Buffer.concat(stdoutChunks).toString(encoding);

      const stderr = encoding === `buffer`
        ? Buffer.concat(stderrChunks)
        : Buffer.concat(stderrChunks).toString(encoding);

      if (code === 0) {
        resolve({code, stdout, stderr});
      } else {
        reject({code, stdout, stderr});
      }
    });
  });
}
