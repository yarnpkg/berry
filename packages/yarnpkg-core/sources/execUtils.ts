import {PortablePath, npath} from '@yarnpkg/fslib';
import crossSpawn            from 'cross-spawn';
import {Readable, Writable}  from 'stream';

export enum EndStrategy {
  Never,
  ErrorCode,
  Always,
}

export type PipevpOptions = {
  cwd: PortablePath,
  env?: {[key: string]: string | undefined},
  end?: EndStrategy,
  strict?: boolean,
  stdin: Readable | null,
  stdout: Writable,
  stderr: Writable,
};

function hasFd(stream: null | Readable | Writable) {
  // @ts-ignore: Not sure how to typecheck this field
  return stream !== null && typeof stream.fd === `number`;
}

function sigintHandler() {
  // We don't want SIGINT to kill our process; we want it to kill the
  // innermost process, whose end will cause our own to exit.
}

// Rather than attaching one SIGINT handler for each process, we
// attach a single one and use a refcount to detect once it's no
// longer needed.
let sigintRefCount = 0;

export async function pipevp(fileName: string, args: Array<string>, {cwd, env = process.env, strict = false, stdin = null, stdout, stderr, end = EndStrategy.Always}: PipevpOptions): Promise<{code: number}> {
  const stdio: Array<any> = [`pipe`, `pipe`, `pipe`];

  if (stdin === null)
    stdio[0] = `ignore`;
  else if (hasFd(stdin))
    stdio[0] = stdin;

  if (hasFd(stdout))
    stdio[1] = stdout;
  if (hasFd(stderr))
    stdio[2] = stderr;

  if (sigintRefCount++ === 0)
    process.on(`SIGINT`, sigintHandler);

  const child = crossSpawn(fileName, args, {
    cwd: npath.fromPortablePath(cwd),
    env: {
      ...env,
      PWD: npath.fromPortablePath(cwd),
    },
    stdio,
  });

  if (!hasFd(stdin) && stdin !== null)
    stdin.pipe(child.stdin!);

  if (!hasFd(stdout))
    child.stdout!.pipe(stdout, {end: false});
  if (!hasFd(stderr))
    child.stderr!.pipe(stderr, {end: false});

  const closeStreams = () => {
    for (const stream of new Set([stdout, stderr])) {
      if (!hasFd(stream)) {
        stream.end();
      }
    }
  };

  return new Promise((resolve, reject) => {
    child.on(`error`, error => {
      if (--sigintRefCount === 0)
        process.off(`SIGINT`, sigintHandler);

      if (end === EndStrategy.Always || end === EndStrategy.ErrorCode)
        closeStreams();

      reject(error);
    });

    child.on(`close`, (code: number, sig: string) => {
      if (--sigintRefCount === 0)
        process.off(`SIGINT`, sigintHandler);

      if (end === EndStrategy.Always || (end === EndStrategy.ErrorCode && code > 0))
        closeStreams();

      if (code === 0 || !strict) {
        resolve({code});
      } else if (code !== null) {
        reject(new Error(`Child "${fileName}" exited with exit code ${code}`));
      } else {
        reject(new Error(`Child "${fileName}" exited with signal ${sig}`));
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

  const nativeCwd = npath.fromPortablePath(cwd);

  if (typeof env.PWD !== `undefined`)
    env = {...env, PWD: nativeCwd};

  const subprocess = crossSpawn(fileName, args, {
    cwd: nativeCwd,
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
        resolve({
          code, stdout, stderr,
        });
      } else {
        reject(Object.assign(new Error(`Child "${fileName}" exited with exit code ${code}\n\n${stderr}`), {
          code, stdout, stderr,
        }));
      }
    });
  });
}
