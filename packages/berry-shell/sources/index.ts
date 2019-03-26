import {xfs, NodeFS}                                                      from '@berry/fslib';
import {CommandSegment, CommandChain, CommandLine, ShellLine, parseShell} from '@berry/parsers';
import {spawn}                                                            from 'child_process';
import {delimiter, posix}                                                 from 'path';
import {PassThrough, Readable, Stream, Writable}                          from 'stream';
import {StringDecoder}                                                    from 'string_decoder';

export type UserOptions = {
  builtins: {[key: string]: UserBuiltin},
  cwd: string,
  env: {[key: string]: string | undefined},
  paths: Array<string>,
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
  variables: {[key: string]: string},
};

export type UserBuiltin = (
  args: Array<string>,
  opts: ShellOptions,
  state: ShellState,
) => Promise<number>;

export type ShellBuiltin = (
  args: Array<string>,
  opts: ShellOptions,
  state: ShellState,
  mustPipe: boolean,
) => Promise<{
  stdin: Writable | null,
  promise: Promise<number>,
}>;

export type ShellOptions = {
  args: Array<string>,
  builtins: Map<string, ShellBuiltin>,
};

export type ShellState = {
  cwd: string,
  environment: {[key: string]: string},
  exitCode: number | null,
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
  variables: {[key: string]: string},
};

function makeBuiltin(builtin: (args: Array<string>, opts: ShellOptions, state: ShellState) => Promise<number>): ShellBuiltin {
  return async (args: Array<string>, opts: ShellOptions, state: ShellState, mustPipe: boolean) => {
    if (!mustPipe) {
      return {
        stdin: null,
        promise: builtin(args, opts, state),
      };
    } else {
      const stdin = new PassThrough();
      return {
        stdin,
        promise: builtin(args, opts, {... state, stdin}).then(result => {
          stdin.end();
          return result;
        }, error => {
          stdin.end();
          throw error;
        }),
      }
    }
  };
}

function cloneState(state: ShellState, mergeWith: Partial<ShellState> = {}) {
  const newState = {... state, ... mergeWith};

  newState.environment = {... state.environment, ... mergeWith.environment };
  newState.variables = {... state.variables, ... mergeWith.variables };

  return newState;
}

const BUILTINS = new Map<string, ShellBuiltin>([
  [`cd`, makeBuiltin(async ([target, ... rest]: Array<string>, opts: ShellOptions, state: ShellState) => {
    const resolvedTarget = posix.resolve(state.cwd, NodeFS.toPortablePath(target));
    const stat = await xfs.statPromise(resolvedTarget);

    if (!stat.isDirectory()) {
      state.stderr.write(`cd: not a directory\n`);
      return 1;
    } else {
      state.cwd = target;
      return 0;
    }
  })],

  [`pwd`, makeBuiltin(async (args: Array<string>, opts: ShellOptions, state: ShellState) => {
    state.stdout.write(`${NodeFS.fromPortablePath(state.cwd)}\n`);
    return 0;
  })],

  [`true`, makeBuiltin(async (args: Array<string>, opts: ShellOptions, state: ShellState) => {
    return 0;
  })],

  [`false`, makeBuiltin(async (args: Array<string>, opts: ShellOptions, state: ShellState) => {
    return 1;
  })],

  [`exit`, makeBuiltin(async ([code, ... rest]: Array<string>, opts: ShellOptions, state: ShellState) => {
    return state.exitCode = parseInt(code, 10);
  })],

  [`echo`, makeBuiltin(async (args: Array<string>, opts: ShellOptions, state: ShellState) => {
    state.stdout.write(`${args.join(` `)}\n`);
    return 0;
  })],

  [`command`, async ([ident, ... rest]: Array<string>, opts: ShellOptions, state: ShellState, mustPipe: boolean) => {
    if (typeof ident === `undefined`)
      return makeBuiltin(async () => 0)([], opts, state, mustPipe);

    const stdio: Array<any> = [state.stdin, state.stdout, state.stderr];
    const isUserStream = (stream: Stream) => stream instanceof PassThrough;

    if (isUserStream(state.stdin) || mustPipe)
      stdio[0] = `pipe`;
    if (isUserStream(state.stdout))
      stdio[1] = `pipe`;
    if (isUserStream(state.stderr))
      stdio[2] = `pipe`;

    const normalizedEnv: {[key: string]: string} = {};
    for (const key of Object.keys(state.environment))
      normalizedEnv[key.toUpperCase()] = state.environment[key] as string;


    const subprocess = spawn(ident, rest, {
      cwd: NodeFS.fromPortablePath(state.cwd),
      shell: process.platform === `win32`, // Needed to execute .cmd files
      env: normalizedEnv,
      stdio,
    });

    if (isUserStream(state.stdin) && !mustPipe)
      state.stdin.pipe(subprocess.stdin);
    if (isUserStream(state.stdout))
      subprocess.stdout.pipe(state.stdout);
    if (isUserStream(state.stderr))
      subprocess.stderr.pipe(state.stderr);

    return {
      stdin: subprocess.stdin,
      promise: new Promise(resolve => {
        subprocess.on(`error`, error => {
          // @ts-ignore
          switch (error.code) {
            case `ENOENT`: {
              state.stderr.write(`command not found: ${ident}\n`);
              resolve(127);
            } break;
            case `EACCESS`: {
              state.stderr.write(`permission denied: ${ident}\n`);
              resolve(128);
            } break;
            default: {
              state.stderr.write(`uncaught error: ${error.message}\n`);
              resolve(1);
            } break;
          }
        });
        subprocess.on(`exit`, code => {
          if (code !== null) {
            resolve(code);
          } else {
            resolve(129);
          }
        });
      }),
    };
  }],
]);

// Keep this function is sync with its implementation in:
// @berry/core/sources/miscUtils.ts
async function releaseAfterUseAsync<T>(fn: () => Promise<T>, cleanup?: () => any) {
  if (!cleanup)
    return await fn();

  try {
    return await fn();
  } finally {
    await cleanup();
  }
}

async function executeBufferedSubshell(ast: ShellLine, opts: ShellOptions, state: ShellState) {
  const chunks: Array<Buffer> = [];
  const stdout = new PassThrough();

  stdout.on(`data`, chunk => chunks.push(chunk));
  await executeShellLine(ast, opts, cloneState(state, {stdout}));

  return Buffer.concat(chunks).toString().replace(/[\r\n]+$/, ``);
}

async function interpolateArguments(commandArgs: Array<Array<CommandSegment>>, opts: ShellOptions, state: ShellState) {
  const interpolated: Array<string> = [];
  let interpolatedSegments: Array<string> = [];

  const split = (raw: string) => {
    return raw.match(/[^ \r\n\t]+/g) || [];
  };

  const push = (segment: string) => {
    interpolatedSegments.push(segment);
  };

  const close = () => {
    if (interpolatedSegments.length > 0)
      interpolated.push(interpolatedSegments.join(``));
    interpolatedSegments = [];
  };

  const pushAndClose = (segment: string) => {
    push(segment);
    close();
  };

  for (const commandArg of commandArgs) {
    for (const segment of commandArg) {

      if (typeof segment === 'string') {

        push(segment);

      } else {

        switch (segment.type) {

          case `shell`: {
            const raw = await executeBufferedSubshell(segment.shell, opts, state);
            if (segment.quoted) {
              push(raw);
            } else for (const part of split(raw)) {
              pushAndClose(part);
            }
          } break;

          case `variable`: {
            switch (segment.name) {

              case `#`: {
                push(String(opts.args.length));
              } break;

              case `@`: {
                if (segment.quoted) {
                  for (const raw of opts.args) {
                    pushAndClose(raw);
                  }
                } else for (const raw of opts.args) {
                  for (const part of split(raw)) {
                    pushAndClose(part);
                  }
                }
              } break;

              case `*`: {
                const raw = opts.args.join(` `);
                if (segment.quoted) {
                  push(raw);
                } else for (const part of split(raw)) {
                  pushAndClose(part);
                }
              } break;

              default: {
                const argIndex = parseInt(segment.name, 10);

                if (Number.isFinite(argIndex)) {
                  if (!(argIndex >= 0 && argIndex < opts.args.length)) {
                    throw new Error(`Unbound argument #${argIndex}`);
                  } else {
                    push(opts.args[argIndex]);
                  }
                } else {
                  if (!(segment.name in state.variables)) {
                    throw new Error(`Unbound variable "${segment.name}"`);
                  } else {
                    push(state.variables[segment.name]);
                  }
                }
              } break;

            }
          } break;
        }
      }

    }

    close();
  }

  return interpolated;
}

/**
 * Executes a command chain. A command chain is a list of commands linked
 * together thanks to the use of either of the `|` or `|&` operators:
 *
 * $ cat hello | grep world | grep -v foobar
 */

function makeCommandAction(args: Array<string>, opts: ShellOptions) {
  if (!opts.builtins.has(args[0]))
    args = [`command`, ... args];

  const [name, ... rest] = args;

  const builtin = opts.builtins.get(name);
  if (typeof builtin === `undefined`)
    throw new Error(`Assertion failed: A builtin should exist for "${name}"`)

  return async (state: ShellState, mustPipe: boolean) => {
    const {stdin, promise} = await builtin(rest, opts, state, mustPipe);
    return {stdin, promise};
  };
}

function makeSubshellAction(ast: ShellLine, opts: ShellOptions) {
  return async (state: ShellState, mustPipe: boolean) => {
    const stdin = new PassThrough();
    const promise = executeShellLine(ast, opts, cloneState(state, {stdin}));

    return {stdin: stdin as Writable, promise};
  };
}

async function executeCommandChain(node: CommandChain, opts: ShellOptions, state: ShellState) {
  const parts = [];

  // First we interpolate all the commands (we don't interpolate subshells
  // because they operate in their own contexts and are allowed to define
  // new internal variables)

  let current: CommandChain | null = node;
  let pipeType = null;

  while (current) {
    let action;

    switch (current.type) {
      case `command`: {
        action = makeCommandAction(await interpolateArguments(current.args, opts, state), opts);
      } break;

      case `subshell`: {
        action = makeSubshellAction(current.subshell, opts);
      } break;
    }

    if (typeof action === `undefined`)
      throw new Error(`Assertion failed: An action should have been generated`);

    parts.push({action, pipeType});

    if (typeof current.then !== `undefined`) {
      pipeType = current.then.type;
      current = current.then.chain;
    } else {
      current = null;
      pipeType = null;
    }
  }

  // Note that the execution starts from the right-most command and
  // progressively moves towards the left-most command. We run them in this
  // order because otherwise we would risk a race condition where (let's
  // use A | B as example) A would start writing before B is ready, which
  // could cause the pipe buffer to overflow and some writes to be lost.

  let stdout = state.stdout;
  let stderr = state.stderr;

  const promises = [];

  for (let t = parts.length - 1; t >= 0; --t) {
    const {action, pipeType} = parts[t];
    const {stdin, promise} = await action(Object.assign(state, {stdout, stderr}), pipeType !== null);

    // If stdout has been piped (ie if the command we're execting isn't the
    // right-most one), then we must close the pipe after our process has
    // finished writing into it. We don't need to do this for the last command
    // because this responsibility goes to the caller (otherwise we would risk
    // closing the real stdout, which isn't meant to happen).
    if (t !== parts.length - 1) {
      const thisStdout = stdout;

      promise.then(() => {
        thisStdout.end();
      }, () => {
        thisStdout.end();
      });
    }

    promises.push(promise);

    switch (pipeType) {
      case null: {
        // no pipe!
      } break;

      case `|`: {
        if (stdin === null)
          throw new Error(`Assertion failed: The pipe is expected to return a writable stream`);

        stdout = stdin;
      } break;

      case `|&`: {
        if (stdin === null)
          throw new Error(`Assertion failed: The pipe is expected to return a writable stream`);

        stdout = stdin;
        stderr = stdin;
      } break;
    }
  }

  const exitCodes = await Promise.all(promises);

  return exitCodes[exitCodes.length - 1];
}

/**
 * Execute a command line. A command line is a list of command shells linked
 * together thanks to the use of either of the `||` or `&&` operators.
 */
async function executeCommandLine(node: CommandLine, opts: ShellOptions, state: ShellState): Promise<number> {
  if (!node.then)
    return await executeCommandChain(node.chain, opts, state);

  const code = await executeCommandChain(node.chain, opts, state);

  // If the execution aborted (usually through "exit"), we must bailout
  if (state.exitCode !== null)
    return state.exitCode;

  // We must update $?, which always contains the exit code from the last command
  state.variables[`?`] = String(code);

  switch (node.then.type) {
    case `&&`: {
      if (code === 0) {
        return await executeCommandLine(node.then.line, opts, state);
      } else {
        return code;
      }
    } break;

    case `||`: {
      if (code !== 0) {
        return await executeCommandLine(node.then.line, opts, state);
      } else {
        return code;
      }
    } break;

    default: {
      throw new Error(`Unsupported command type: "${node.then.type}"`);
    } break;
  }
}

async function executeShellLine(node: ShellLine, opts: ShellOptions, state: ShellState) {
  let lastExitCode = 0;

  for (const command of node) {
    lastExitCode = await executeCommandLine(command, opts, state);

    // If the execution aborted (usually through "exit"), we must bailout
    if (state.exitCode !== null)
      return state.exitCode;

    // We must update $?, which always contains the exit code from the last command
    state.variables[`?`] = String(lastExitCode);
  }

  return lastExitCode;
}

function locateArgsVariable(node: ShellLine): boolean {
  return node.some(command => {
    while (command) {
      let chain = command.chain;

      while (chain) {
        let hasArgs;

        switch (chain.type) {
          case `subshell`: {
            hasArgs = locateArgsVariable(chain.subshell);
          } break;

          case `command`: {
            hasArgs = chain.args.some(arg => {
              return arg.some(segment => {
                if (typeof segment === 'string')
                  return false;

                switch (segment.type) {
                  case `variable`: {
                    return segment.name === `@` || segment.name === `#` || segment.name === `*` || Number.isFinite(parseInt(segment.name, 10));
                  } break;

                  case `shell`: {
                    return locateArgsVariable(segment.shell);
                  } break;

                  default: {
                    return false;
                  } break;
                }
              });
            });
          } break;
        }

        if (hasArgs)
          return true;

        if (!chain.then)
          break;

        chain = chain.then.chain;
      }

      if (!command.then)
        break;

      command = command.then.line;
    }

    return false;
  });
}

export async function execute(command: string, args: Array<string> = [], {
  builtins = {},
  cwd = process.cwd(),
  env = process.env,
  paths = [],
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
  variables = {},
}: Partial<UserOptions> = {}) {
  const normalizedEnv: {[key: string]: string} = {};
  for (const key of Object.keys(env))
    if (typeof env[key] !== `undefined`)
      normalizedEnv[key.toUpperCase()] = env[key] as string;

  if (paths.length > 0)
    normalizedEnv.PATH = normalizedEnv.PATH
      ? `${paths.join(delimiter)}${delimiter}${env.PATH}`
      : `${paths.join(delimiter)}`;

  const normalizedBuiltins = new Map(BUILTINS);
  for (const [key, action] of Object.entries(builtins))
    normalizedBuiltins.set(key, makeBuiltin(action));

  const ast = parseShell(command);

  // If the shell line doesn't use the args, inject it at the end of the last command
  if (!locateArgsVariable(ast) && ast.length > 0) {
    let command = ast[ast.length - 1];
    while (command.then)
      command = command.then.line;

    let chain = command.chain;
    while (chain.then)
      chain = chain.then.chain;

    if (chain.type === `command`) {
      chain.args = chain.args.concat(args.map(arg => {
        return [arg];
      }));
    }
  }

  return await executeShellLine(ast, {
    args,
    builtins: normalizedBuiltins,
  }, {
    cwd,
    environment: normalizedEnv,
    exitCode: null,
    stdin,
    stdout,
    stderr,
    variables: Object.assign(Object.create(variables), {
      [`?`]: 0,
    }),
  });
}
