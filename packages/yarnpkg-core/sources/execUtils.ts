import {PortablePath, npath, ppath} from '@yarnpkg/fslib';
import {ChildProcess}               from 'child_process';
import crossSpawn                   from 'cross-spawn';
import {Readable, Writable}         from 'stream';

import {Configuration}              from './Configuration';
import {MessageName}                from './MessageName';
import {Report, ReportError}        from './Report';
import * as formatUtils             from './formatUtils';

export enum EndStrategy {
  Never,
  ErrorCode,
  Always,
}

export type PipevpOptions = {
  cwd: PortablePath;
  env?: {[key: string]: string | undefined};
  end?: EndStrategy;
  strict?: boolean;
  stdin: Readable | null;
  stdout: Writable;
  stderr: Writable;
};

export type PipeErrorOptions = {
  fileName: string;
  code: number;
  signal: NodeJS.Signals | null;
};

export class PipeError extends ReportError {
  code: number;

  constructor({fileName, code, signal}: PipeErrorOptions) {
    // It doesn't matter whether we create a new Configuration from the cwd or from a
    // temp directory since in none of these cases the user's rc values will be respected.
    // TODO: find a way to respect them
    const configuration = Configuration.create(ppath.cwd());
    const prettyFileName = formatUtils.pretty(configuration, fileName, formatUtils.Type.PATH);

    super(MessageName.EXCEPTION, `Child ${prettyFileName} reported an error`, report => {
      reportExitStatus(code, signal, {configuration, report});
    });

    this.code = getExitCode(code, signal);
  }
}

export type ExecErrorOptions = PipeErrorOptions & {
  stdout: Buffer | string;
  stderr: Buffer | string;
};

export class ExecError extends PipeError {
  stdout: Buffer | string;
  stderr: Buffer | string;

  constructor({fileName, code, signal, stdout, stderr}: ExecErrorOptions) {
    super({fileName, code, signal});

    this.stdout = stdout;
    this.stderr = stderr;
  }
}

function hasFd(stream: null | Readable | Writable) {
  // @ts-expect-error: Not sure how to typecheck this field
  return stream !== null && typeof stream.fd === `number`;
}

const activeChildren = new Set<ChildProcess>();

function sigintHandler() {
  // We don't want SIGINT to kill our process; we want it to kill the
  // innermost process, whose end will cause our own to exit.
}

function sigtermHandler() {
  for (const child of activeChildren) {
    child.kill();
  }
}

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

  const child = crossSpawn(fileName, args, {
    cwd: npath.fromPortablePath(cwd),
    env: {
      ...env,
      PWD: npath.fromPortablePath(cwd),
    },
    stdio,
  });

  activeChildren.add(child);

  if (activeChildren.size === 1) {
    process.on(`SIGINT`, sigintHandler);
    process.on(`SIGTERM`, sigtermHandler);
  }

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
      activeChildren.delete(child);

      if (activeChildren.size === 0) {
        process.off(`SIGINT`, sigintHandler);
        process.off(`SIGTERM`, sigtermHandler);
      }

      if (end === EndStrategy.Always || end === EndStrategy.ErrorCode)
        closeStreams();

      reject(error);
    });

    child.on(`close`, (code, signal) => {
      activeChildren.delete(child);

      if (activeChildren.size === 0) {
        process.off(`SIGINT`, sigintHandler);
        process.off(`SIGTERM`, sigtermHandler);
      }

      if (end === EndStrategy.Always || (end === EndStrategy.ErrorCode && code > 0))
        closeStreams();

      if (code === 0 || !strict) {
        resolve({code: getExitCode(code, signal)});
      } else {
        reject(new PipeError({fileName, code, signal}));
      }
    });
  });
}

export type ExecvpOptions = {
  cwd: PortablePath;
  env?: {[key: string]: string | undefined};
  encoding?: string;
  strict?: boolean;
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
    subprocess.on(`error`, err => {
      const configuration = Configuration.create(cwd);
      const prettyFileName = formatUtils.pretty(configuration, fileName, formatUtils.Type.PATH);

      reject(new ReportError(MessageName.EXCEPTION, `Process ${prettyFileName} failed to spawn`, report => {
        report.reportError(MessageName.EXCEPTION, `  ${formatUtils.prettyField(configuration, {
          label: `Thrown Error`,
          value: formatUtils.tuple(formatUtils.Type.NO_HINT, err.message),
        })}`);
      }));
    });

    subprocess.on(`close`, (code, signal) => {
      const stdout = encoding === `buffer`
        ? Buffer.concat(stdoutChunks)
        : Buffer.concat(stdoutChunks).toString(encoding);

      const stderr = encoding === `buffer`
        ? Buffer.concat(stderrChunks)
        : Buffer.concat(stderrChunks).toString(encoding);

      if (code === 0 || !strict) {
        resolve({
          code: getExitCode(code, signal), stdout, stderr,
        });
      } else {
        reject(new ExecError({fileName, code, signal, stdout, stderr}));
      }
    });
  });
}

const signalToCodeMap = new Map<NodeJS.Signals | null, number>([
  [`SIGINT`, 2], // ctrl-c
  [`SIGQUIT`, 3], // ctrl-\
  [`SIGKILL`, 9], // hard kill
  [`SIGTERM`, 15], // default signal for kill
]);

function getExitCode(code: number | null, signal: NodeJS.Signals | null): number {
  const signalCode = signalToCodeMap.get(signal);
  if (typeof signalCode !== `undefined`) {
    return 128 + signalCode;
  } else {
    return code ?? 1;
  }
}

function reportExitStatus(code: number | null, signal: string | null, {configuration, report}: {configuration: Configuration, report: Report}) {
  report.reportError(MessageName.EXCEPTION, `  ${formatUtils.prettyField(configuration, code !== null ? {
    label: `Exit Code`,
    value: formatUtils.tuple(formatUtils.Type.NUMBER, code),
  } : {
    label: `Exit Signal`,
    value: formatUtils.tuple(formatUtils.Type.CODE, signal),
  })}`);
}
