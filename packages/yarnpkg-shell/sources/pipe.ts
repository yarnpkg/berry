import {ChildProcess}                               from 'child_process';
import crossSpawn                                   from 'cross-spawn';
import {PassThrough, Readable, Transform, Writable} from 'stream';
import {StringDecoder}                              from 'string_decoder';

import {ShellOptions, ShellState}                   from './index';

export enum Pipe {
  STDIN = 0b00,
  STDOUT = 0b01,
  STDERR = 0b10,
}

// This is hell to type
export type Stdio = [
  any,
  any,
  any,
];

export type ProcessImplementation = (
  stdio: Stdio,
) => {
  stdin: Writable,
  promise: Promise<number>,
};

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

export function makeProcess(name: string, args: Array<string>, opts: ShellOptions, spawnOpts: any): ProcessImplementation {
  return (stdio: Stdio) => {
    const stdin = stdio[0] instanceof Transform
      ? `pipe`
      : stdio[0];

    const stdout = stdio[1] instanceof Transform
      ? `pipe`
      : stdio[1];

    const stderr = stdio[2] instanceof Transform
      ? `pipe`
      : stdio[2];

    const child = crossSpawn(name, args, {...spawnOpts, stdio: [
      stdin,
      stdout,
      stderr,
    ]});

    activeChildren.add(child);

    if (activeChildren.size === 1) {
      process.on(`SIGINT`, sigintHandler);
      process.on(`SIGTERM`, sigtermHandler);
    }

    if (stdio[0] instanceof Transform)
      stdio[0].pipe(child.stdin!);
    if (stdio[1] instanceof Transform)
      child.stdout!.pipe(stdio[1], {end: false});
    if (stdio[2] instanceof Transform)
      child.stderr!.pipe(stdio[2], {end: false});

    return {
      stdin: child.stdin!,
      promise: new Promise(resolve => {
        child.on(`error`, error => {
          activeChildren.delete(child);

          if (activeChildren.size === 0) {
            process.off(`SIGINT`, sigintHandler);
            process.off(`SIGTERM`, sigtermHandler);
          }

          // @ts-expect-error
          switch (error.code) {
            case `ENOENT`: {
              stdio[2].write(`command not found: ${name}\n`);
              resolve(127);
            } break;
            case `EACCES`: {
              stdio[2].write(`permission denied: ${name}\n`);
              resolve(128);
            } break;
            default: {
              stdio[2].write(`uncaught error: ${error.message}\n`);
              resolve(1);
            } break;
          }
        });

        child.on(`exit`, code => {
          activeChildren.delete(child);

          if (activeChildren.size === 0) {
            process.off(`SIGINT`, sigintHandler);
            process.off(`SIGTERM`, sigtermHandler);
          }

          if (code !== null) {
            resolve(code);
          } else {
            resolve(129);
          }
        });
      }),
    };
  };
}

export function makeBuiltin(builtin: (opts: any) => Promise<number>): ProcessImplementation {
  return (stdio: Stdio) => {
    const stdin = stdio[0] === `pipe`
      ? new PassThrough()
      : stdio[0];

    return {
      stdin,
      promise: Promise.resolve().then(() => builtin({
        stdin,
        stdout: stdio[1],
        stderr: stdio[2],
      })),
    };
  };
}

interface StreamLock<StreamType> {
  close(): void;
  get(): StreamType;
}

export class ProtectedStream<StreamType> implements StreamLock<StreamType> {
  private stream: StreamType;

  constructor(stream: StreamType) {
    this.stream = stream;
  }

  close() {
    // Ignore close request
  }

  get() {
    return this.stream;
  }
}

class PipeStream implements StreamLock<Writable> {
  private stream: Writable | null = null;

  close() {
    if (this.stream === null) {
      throw new Error(`Assertion failed: No stream attached`);
    } else {
      this.stream.end();
    }
  }

  attach(stream: Writable) {
    this.stream = stream;
  }

  get() {
    if (this.stream === null) {
      throw new Error(`Assertion failed: No stream attached`);
    } else {
      return this.stream;
    }
  }
}

type StartOptions = {
  stdin: StreamLock<Readable>,
  stdout: StreamLock<Writable>,
  stderr: StreamLock<Writable>,
};

export class Handle {
  private ancestor: Handle | null;
  private implementation: ProcessImplementation;

  private stdin: StreamLock<Readable> | null = null;
  private stdout: StreamLock<Writable> | null = null;
  private stderr: StreamLock<Writable> | null = null;

  private pipe: PipeStream | null = null;

  static start(implementation: ProcessImplementation, {stdin, stdout, stderr}: StartOptions) {
    const chain = new Handle(null, implementation);

    chain.stdin = stdin;
    chain.stdout = stdout;
    chain.stderr = stderr;

    return chain;
  }

  constructor(ancestor: Handle | null, implementation: ProcessImplementation) {
    this.ancestor = ancestor;
    this.implementation = implementation;
  }

  pipeTo(implementation: ProcessImplementation, source = Pipe.STDOUT) {
    const next = new Handle(this, implementation);

    const pipe = new PipeStream();
    next.pipe = pipe;

    next.stdout = this.stdout;
    next.stderr = this.stderr;

    if ((source & Pipe.STDOUT) === Pipe.STDOUT)
      this.stdout = pipe;
    else if (this.ancestor !== null)
      this.stderr = this.ancestor.stdout;

    if ((source & Pipe.STDERR) === Pipe.STDERR)
      this.stderr = pipe;
    else if (this.ancestor !== null)
      this.stderr = this.ancestor.stderr;

    return next;
  }

  async exec() {
    const stdio: Stdio = [
      `ignore`,
      `ignore`,
      `ignore`,
    ];

    if (this.pipe) {
      stdio[0] = `pipe`;
    } else {
      if (this.stdin === null) {
        throw new Error(`Assertion failed: No input stream registered`);
      } else {
        stdio[0] = this.stdin.get();
      }
    }

    let stdoutLock: StreamLock<Writable>;
    if (this.stdout === null) {
      throw new Error(`Assertion failed: No output stream registered`);
    } else {
      stdoutLock = this.stdout;
      stdio[1] = stdoutLock.get();
    }

    let stderrLock: StreamLock<Writable>;
    if (this.stderr === null) {
      throw new Error(`Assertion failed: No error stream registered`);
    } else {
      stderrLock = this.stderr;
      stdio[2] = stderrLock.get();
    }

    const child = this.implementation(stdio);

    if (this.pipe)
      this.pipe.attach(child.stdin);

    return await child.promise.then(code => {
      stdoutLock.close();
      stderrLock.close();

      return code;
    });
  }

  async run() {
    const promises = [];
    for (let handle: Handle | null = this; handle; handle = handle.ancestor)
      promises.push(handle.exec());

    const exitCodes = await Promise.all(promises);
    return exitCodes[0];
  }
}

export function start(p: ProcessImplementation, opts: StartOptions) {
  return Handle.start(p, opts);
}

function createStreamReporter(reportFn: (text: string) => void, prefix: string | null = null) {
  const stream = new PassThrough();
  const decoder = new StringDecoder();

  let buffer = ``;

  stream.on(`data`, chunk => {
    let chunkStr = decoder.write(chunk);
    let lineIndex;

    do {
      lineIndex = chunkStr.indexOf(`\n`);

      if (lineIndex !== -1) {
        const line = buffer + chunkStr.substr(0, lineIndex);

        chunkStr = chunkStr.substr(lineIndex + 1);
        buffer = ``;

        if (prefix !== null) {
          reportFn(`${prefix} ${line}`);
        } else {
          reportFn(line);
        }
      }
    } while (lineIndex !== -1);

    buffer += chunkStr;
  });

  stream.on(`end`, () => {
    const last = decoder.end();

    if (last !== ``) {
      if (prefix !== null) {
        reportFn(`${prefix} ${last}`);
      } else {
        reportFn(last);
      }
    }
  });

  return stream;
}

export function createOutputStreamsWithPrefix(state: ShellState, {prefix}: {prefix: string | null}) {
  return {
    stdout: createStreamReporter(text => state.stdout.write(`${text}\n`), (state.stdout as any).isTTY ? prefix : null),
    stderr: createStreamReporter(text => state.stderr.write(`${text}\n`), (state.stderr as any).isTTY ? prefix : null),
  };
}
