import {PortablePath, npath} from '@yarnpkg/fslib';
import crossSpawn            from 'cross-spawn';
import {Readable, Writable}  from 'stream';

export type PipevpOptions = {
  cwd: PortablePath,
  env?: {[key: string]: string | undefined},
  strict?: boolean,
  stdin: Readable | null,
  stdout: Writable,
  stderr: Writable,
};

function hasFd(stream: null | Readable | Writable) {
  // @ts-ignore: Not sure how to typecheck this field
  return stream !== null && typeof stream.fd === `number`;
}

export async function pipevp(fileName: string, args: Array<string>, {cwd, env = process.env, strict = false, stdin = null, stdout, stderr}: PipevpOptions): Promise<{code: number}> {
  const stdio: Array<any> = [`pipe`, `pipe`, `pipe`];

  if (stdin === null)
    stdio[0] = `ignore`;
  else if (hasFd(stdin))
    stdio[0] = stdin;

  if (hasFd(stdout))
    stdio[1] = stdout;
  if (hasFd(stderr))
    stdio[2] = stderr;

  const subprocess = crossSpawn(fileName, args, {
    cwd: npath.fromPortablePath(cwd),
    env,
    stdio,
  });

  if (!hasFd(stdin) && stdin !== null)
    stdin.pipe(subprocess.stdin!);

  if (!hasFd(stdout))
    subprocess.stdout!.pipe(stdout);
  if (!hasFd(stderr))
    subprocess.stderr!.pipe(stderr);

  return new Promise((resolve, reject) => {
    subprocess.on(`close`, (code: number) => {
      if (code === 0 || !strict) {
        resolve({code});
      } else {
        reject(new Error(`Child "${fileName}" exited with exit code ${code}`));
      }
    });
  });
}

export type ExecvpOptions = {
  cwd: PortablePath,
  env?: {[key: string]: string | undefined},
  encoding?: string,
  strict?: boolean,
};

export async function execvp(fileName: string, args: Array<string>, opts: ExecvpOptions & {encoding: 'buffer'}): Promise<{code: number, stdout: Buffer, stderr: Buffer}>;
export async function execvp(fileName: string, args: Array<string>, opts: ExecvpOptions & {encoding: string}): Promise<{code: number, stdout: string, stderr: string}>;
export async function execvp(fileName: string, args: Array<string>, opts: ExecvpOptions): Promise<{code: number, stdout: string, stderr: string}>;

export async function execvp(fileName: string, args: Array<string>, {cwd, env = process.env, encoding = `utf8`, strict = false}: ExecvpOptions) {
  const stdio: any = [`ignore`, `pipe`, `pipe`];

  const stdoutChunks: Array<Buffer> = [];
  const stderrChunks: Array<Buffer> = [];

  const subprocess = crossSpawn(fileName, args, {
    cwd: npath.fromPortablePath(cwd),
    env,
    stdio,
  });

  subprocess.stdout!.on(`data`, (chunk: Buffer) => {
    stdoutChunks.push(chunk);
  });

  subprocess.stderr!.on(`data`, (chunk: Buffer) => {
    stderrChunks.push(chunk);
  });

  return await new Promise((resolve, reject) => {
    subprocess.on(`close`, (code: number) => {
      const stdout = encoding === `buffer`
        ? Buffer.concat(stdoutChunks)
        : Buffer.concat(stdoutChunks).toString(encoding);

      const stderr = encoding === `buffer`
        ? Buffer.concat(stderrChunks)
        : Buffer.concat(stderrChunks).toString(encoding);

      if (code === 0 || !strict) {
        resolve({code, stdout, stderr});
      } else {
        reject(new Error(`Child "${fileName}" exited with exit code ${code}\n\n${stderr}`));
      }
    });
  });
}
