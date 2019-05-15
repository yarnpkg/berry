import {xfs, NodeFS, ppath, PortablePath}                                 from '@berry/fslib';
import {CommandSegment, CommandChain, CommandLine, ShellLine, parseShell} from '@berry/parsers';
import {PassThrough, Readable, Writable}                                  from 'stream';

import {Handle, ProtectedStream, Stdio, start, makeBuiltin, makeProcess}  from './pipe';

export type UserOptions = {
  builtins: {[key: string]: ShellBuiltin},
  cwd: PortablePath,
  env: {[key: string]: string | undefined},
  stdin: Readable | null,
  stdout: Writable,
  stderr: Writable,
  variables: {[key: string]: string},
};

export type ShellBuiltin = (
  args: Array<string>,
  opts: ShellOptions,
  state: ShellState,
) => Promise<number>;

export type ShellOptions = {
  args: Array<string>,
  builtins: Map<string, ShellBuiltin>,
  initialStdin: Readable,
  initialStdout: Writable,
  initialStderr: Writable,
};

export type ShellState = {
  cwd: PortablePath,
  environment: {[key: string]: string},
  exitCode: number | null,
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
  variables: {[key: string]: string},
};

function cloneState(state: ShellState, mergeWith: Partial<ShellState> = {}) {
  const newState = {...state, ...mergeWith};

  newState.environment = {...state.environment, ...mergeWith.environment};
  newState.variables = {...state.variables, ...mergeWith.variables};

  return newState;
}

const BUILTINS = new Map<string, ShellBuiltin>([
  [`cd`, async ([target, ...rest]: Array<string>, opts: ShellOptions, state: ShellState) => {
    const resolvedTarget = ppath.resolve(state.cwd, NodeFS.toPortablePath(target));
    const stat = await xfs.statPromise(resolvedTarget);

    if (!stat.isDirectory()) {
      state.stderr.write(`cd: not a directory\n`);
      return 1;
    } else {
      state.cwd = resolvedTarget;
      return 0;
    }
  }],

  [`pwd`, async (args: Array<string>, opts: ShellOptions, state: ShellState) => {
    state.stdout.write(`${NodeFS.fromPortablePath(state.cwd)}\n`);
    return 0;
  }],

  [`true`, async (args: Array<string>, opts: ShellOptions, state: ShellState) => {
    return 0;
  }],

  [`false`, async (args: Array<string>, opts: ShellOptions, state: ShellState) => {
    return 1;
  }],

  [`exit`, async ([code, ...rest]: Array<string>, opts: ShellOptions, state: ShellState) => {
    return state.exitCode = parseInt(code, 10);
  }],

  [`echo`, async (args: Array<string>, opts: ShellOptions, state: ShellState) => {
    state.stdout.write(`${args.join(` `)}\n`);
    return 0;
  }],
]);

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
            } else {
              for (const part of split(raw)) {
                pushAndClose(part);
              }
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
                } else {
                  for (const raw of opts.args) {
                    for (const part of split(raw)) {
                      pushAndClose(part);
                    }
                  }
                }
              } break;

              case `*`: {
                const raw = opts.args.join(` `);
                if (segment.quoted) {
                  push(raw);
                } else {
                  for (const part of split(raw)) {
                    pushAndClose(part);
                  }
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

function makeCommandAction(args: Array<string>, opts: ShellOptions, state: ShellState) {
  if (!opts.builtins.has(args[0]))
    args = [`command`, ...args];

  const [name, ...rest] = args;
  if (name === `command`) {
    return makeProcess(rest[0], rest.slice(1), opts, {
      cwd: NodeFS.fromPortablePath(state.cwd),
      env: state.environment,
    });
  }

  const builtin = opts.builtins.get(name);
  if (typeof builtin === `undefined`)
    throw new Error(`Assertion failed: A builtin should exist for "${name}"`)

  return makeBuiltin(async ({stdin, stdout, stderr}) => {
    state.stdin = stdin;
    state.stdout = stdout;
    state.stderr = stderr;

    return await builtin(rest, opts, state);
  });
}

function makeSubshellAction(ast: ShellLine, opts: ShellOptions, state: ShellState) {
  return (stdio: Stdio) => {
    const stdin = new PassThrough();
    const promise = executeShellLine(ast, opts, cloneState(state, {stdin}));

    return {stdin, promise};
  };
}

async function executeCommandChain(node: CommandChain, opts: ShellOptions, state: ShellState) {
  let current: CommandChain | null = node;
  let pipeType = null;

  let execution: Handle | null = null;

  while (current) {
    // Only the final segment is allowed to modify the shell state; all the
    // other ones are isolated
    const activeState = current.then
      ? {...state}
      : state;

    let action;
    switch (current.type) {
      case `command`: {
        action = makeCommandAction(await interpolateArguments(current.args, opts, state), opts, activeState);
      } break;

      case `subshell`: {
      // We don't interpolate the subshell because it will be recursively
      // interpolated within its own context
        action = makeSubshellAction(current.subshell, opts, activeState);
      } break;
    }

    if (typeof action === `undefined`)
      throw new Error(`Assertion failed: An action should have been generated`);

    if (pipeType === null) {
      // If we're processing the left-most segment of the command, we start a
      // new execution pipeline
      execution = start(action, {
        stdin: new ProtectedStream<Readable>(activeState.stdin),
        stdout: new ProtectedStream<Writable>(activeState.stdout),
        stderr: new ProtectedStream<Writable>(activeState.stderr),
      });
    } else {
      if (execution === null)
        throw new Error(`The execution pipeline should have been setup`);

      // Otherwise, depending on the exaxct pipe type, we either pipe stdout
      // only or stdout and stderr
      switch (pipeType) {
        case `|`: {
          execution = execution.pipeTo(action);
        } break;

        case `|&`: {
          execution = execution.pipeTo(action);
        } break;
      }
    }

    if (current.then) {
      pipeType = current.then.type;
      current = current.then.chain;
    } else {
      current = null;
    }
  }

  if (execution === null)
    throw new Error(`Assertion failed: The execution pipeline should have been setup`);

  return await execution.run();
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

  // We must update $?, which always contains the exit code from
  // the right-most command
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
  let rightMostExitCode = 0;

  for (const command of node) {
    rightMostExitCode = await executeCommandLine(command, opts, state);

    // If the execution aborted (usually through "exit"), we must bailout
    if (state.exitCode !== null)
      return state.exitCode;

    // We must update $?, which always contains the exit code from
    // the right-most command
    state.variables[`?`] = String(rightMostExitCode);
  }

  return rightMostExitCode;
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
  cwd = NodeFS.toPortablePath(process.cwd()),
  env = process.env,
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
  variables = {},
}: Partial<UserOptions> = {}) {
  const normalizedEnv: {[key: string]: string} = {};
  for (const [key, value] of Object.entries(env))
    if (typeof value !== `undefined`)
      normalizedEnv[key] = value;

  const normalizedBuiltins = new Map(BUILTINS);
  for (const [key, builtin] of Object.entries(builtins))
    normalizedBuiltins.set(key, builtin);

  // This is meant to be the equivalent of /dev/null
  if (stdin === null) {
    stdin = new PassThrough();
    (stdin as PassThrough).end();
  }

  const ast = parseShell(command);

  // If the shell line doesn't use the args, inject it at the end of the
  // right-most command
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
    initialStdin: stdin,
    initialStdout: stdout,
    initialStderr: stderr,
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
