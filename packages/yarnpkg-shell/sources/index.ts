import {PortablePath, npath, ppath, xfs, FakeFS, PosixFS}                            from '@yarnpkg/fslib';
import {EnvSegment}                                                                  from '@yarnpkg/parsers';
import {Argument, ArgumentSegment, CommandChain, CommandLine, ShellLine, parseShell} from '@yarnpkg/parsers';
import fastGlob                                                                      from 'fast-glob';
import {PassThrough, Readable, Writable}                                             from 'stream';

import {makeBuiltin, makeProcess}                                                    from './pipe';
import {Handle, ProcessImplementation, ProtectedStream, Stdio, start}                from './pipe';

export type Glob = {
  isGlobPattern: (arg: string) => boolean,
  match: (pattern: string, options: {cwd: PortablePath, fs?: FakeFS<PortablePath>}) => Promise<Array<string>>,
};

export type UserOptions = {
  builtins: {[key: string]: ShellBuiltin},
  cwd: PortablePath,
  env: {[key: string]: string | undefined},
  stdin: Readable | null,
  stdout: Writable,
  stderr: Writable,
  variables: {[key: string]: string},
  glob: Glob,
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
  glob: Glob,
};

export type ShellState = {
  cwd: PortablePath,
  environment: {[key: string]: string},
  exitCode: number | null,
  procedures: {[key: string]: ProcessImplementation},
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
    const resolvedTarget = ppath.resolve(state.cwd, npath.toPortablePath(target));
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
    state.stdout.write(`${npath.fromPortablePath(state.cwd)}\n`);
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

  [`__ysh_run_procedure`, async (args: Array<string>, opts: ShellOptions, state: ShellState) => {
    const procedure = state.procedures[args[0]];

    const exitCode = await start(procedure, {
      stdin: new ProtectedStream<Readable>(state.stdin),
      stdout: new ProtectedStream<Writable>(state.stdout),
      stderr: new ProtectedStream<Writable>(state.stderr),
    }).run();

    return exitCode;
  }],

  [`__ysh_set_redirects`, async (args: Array<string>, opts: ShellOptions, state: ShellState) => {
    let stdin = state.stdin;
    let stdout = state.stdout;
    const stderr = state.stderr;

    const inputs: Array<() => Readable> = [];
    const outputs: Array<Writable> = [];

    let t = 0;

    while (args[t] !== `--`) {
      const type = args[t++];

      const count = Number(args[t++]);
      const last = t + count;

      for (let u = t; u < last; ++t, ++u) {
        switch (type) {
          case `<`: {
            inputs.push(() => {
              return xfs.createReadStream(ppath.resolve(state.cwd, npath.toPortablePath(args[u])));
            });
          } break;
          case `<<<`: {
            inputs.push(() => {
              const input = new PassThrough();
              process.nextTick(() => {
                input.write(`${args[u]}\n`);
                input.end();
              });
              return input;
            });
          } break;
          case `>`: {
            outputs.push(xfs.createWriteStream(ppath.resolve(state.cwd, npath.toPortablePath(args[u]))));
          } break;
          case `>>`: {
            outputs.push(xfs.createWriteStream(ppath.resolve(state.cwd, npath.toPortablePath(args[u])), {flags: `a`}));
          } break;
        }
      }
    }

    if (inputs.length > 0) {
      const pipe = new PassThrough();
      stdin = pipe;

      const bindInput = (n: number) => {
        if (n === inputs.length) {
          pipe.end();
        } else {
          const input = inputs[n]();
          input.pipe(pipe, {end: false});
          input.on(`end`, () => {
            bindInput(n + 1);
          });
        }
      };

      bindInput(0);
    }

    if (outputs.length > 0) {
      const pipe = new PassThrough();
      stdout = pipe;

      for (const output of outputs) {
        pipe.pipe(output);
      }
    }

    const exitCode = await start(makeCommandAction(args.slice(t + 1), opts, state), {
      stdin: new ProtectedStream<Readable>(stdin),
      stdout: new ProtectedStream<Writable>(stdout),
      stderr: new ProtectedStream<Writable>(stderr),
    }).run();

    // Close all the outputs (since the shell never closes the output stream)
    await Promise.all(outputs.map(output => {
      // Wait until the output got flushed to the disk
      return new Promise(resolve => {
        output.on(`close`, () => {
          resolve();
        });
        output.end();
      });
    }));

    return exitCode;
  }],
]);

async function executeBufferedSubshell(ast: ShellLine, opts: ShellOptions, state: ShellState) {
  const chunks: Array<Buffer> = [];
  const stdout = new PassThrough();

  stdout.on(`data`, chunk => chunks.push(chunk));
  await executeShellLine(ast, opts, cloneState(state, {stdout}));

  return Buffer.concat(chunks).toString().replace(/[\r\n]+$/, ``);
}

async function applyEnvVariables(environmentSegments: Array<EnvSegment>, opts: ShellOptions, state: ShellState) {
  const envPromises = environmentSegments.map(async envSegment => {
    const interpolatedArgs = await interpolateArguments(envSegment.args, opts, state);

    return {
      name: envSegment.name,
      value: interpolatedArgs.join(` `),
    };
  });

  const interpolatedEnvs = await Promise.all(envPromises);

  return interpolatedEnvs.reduce((envs, env) => {
    envs[env.name] = env.value;
    return envs;
  }, {} as ShellState['environment']);
}

async function interpolateArguments(commandArgs: Array<Argument>, opts: ShellOptions, state: ShellState) {
  const redirections = new Map();

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

  const redirect = (type: string, target: string) => {
    let targets = redirections.get(type);

    if (typeof targets === `undefined`)
      redirections.set(type, targets = []);

    targets.push(target);
  };

  for (const commandArg of commandArgs) {
    switch (commandArg.type) {
      case `redirection`: {
        const interpolatedArgs = await interpolateArguments(commandArg.args, opts, state);
        for (const interpolatedArg of interpolatedArgs) {
          redirect(commandArg.subtype, interpolatedArg);
        }
      } break;

      case `argument`: {
        for (const segment of commandArg.segments) {
          switch (segment.type) {
            case `text`: {
              push(segment.text);
            } break;

            case `glob`: {
              const matches = await opts.glob.match(segment.pattern, {cwd: state.cwd});
              if (!matches.length)
                throw new Error(`No file matches found: "${segment.pattern}". Note: Glob patterns currently only support files that exist on the filesystem (Help Wanted)`);

              for (const match of matches.sort()) {
                pushAndClose(match);
              }
            } break;

            case `shell`: {
              const raw = await executeBufferedSubshell(segment.shell, opts, state);
              if (segment.quoted) {
                push(raw);
              } else {
                const parts = split(raw);

                for (let t = 0; t < parts.length - 1; ++t)
                  pushAndClose(parts[t]);

                push(parts[parts.length - 1]);
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
                      const parts = split(raw);

                      for (let t = 0; t < parts.length - 1; ++t)
                        pushAndClose(parts[t]);

                      push(parts[parts.length - 1]);
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
                    if (Object.prototype.hasOwnProperty.call(state.variables, segment.name)) {
                      push(state.variables[segment.name]);
                    } else if (Object.prototype.hasOwnProperty.call(state.environment, segment.name)) {
                      push(state.environment[segment.name]);
                    } else if (segment.defaultValue) {
                      push((await interpolateArguments(segment.defaultValue, opts, state)).join(` `));
                    } else {
                      throw new Error(`Unbound variable "${segment.name}"`);
                    }
                  }
                } break;
              }
            } break;
          }
        }
      } break;
    }

    close();
  }

  if (redirections.size > 0) {
    const redirectionArgs: Array<string> = [];

    for (const [subtype, targets] of redirections.entries())
      redirectionArgs.splice(redirectionArgs.length, 0, subtype, String(targets.length), ...targets);

    interpolated.splice(0, 0, `__ysh_set_redirects`, ...redirectionArgs, `--`);
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

  const nativeCwd = npath.fromPortablePath(state.cwd);

  let env = state.environment;
  if (typeof env.PWD !== `undefined`)
    env = {...env, PWD: nativeCwd};

  const [name, ...rest] = args;
  if (name === `command`) {
    return makeProcess(rest[0], rest.slice(1), opts, {
      cwd: nativeCwd,
      env,
    });
  }

  const builtin = opts.builtins.get(name);
  if (typeof builtin === `undefined`)
    throw new Error(`Assertion failed: A builtin should exist for "${name}"`);

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
        const args = await interpolateArguments(current.args, opts, state);
        const environment = await applyEnvVariables(current.envs, opts, state);

        action = current.envs.length
          ? makeCommandAction(args, opts, cloneState(activeState, {environment}))
          : makeCommandAction(args, opts, activeState);
      } break;

      case `subshell`: {
        const args = await interpolateArguments(current.args, opts, state);

        // We don't interpolate the subshell because it will be recursively
        // interpolated within its own context
        const procedure = makeSubshellAction(current.subshell, opts, activeState);

        if (args.length === 0) {
          action = procedure;
        } else {
          let key;
          do {
            key = String(Math.random());
          } while (Object.prototype.hasOwnProperty.call(activeState.procedures, key));

          activeState.procedures = {...activeState.procedures};
          activeState.procedures[key] = procedure;

          action = makeCommandAction([...args, `__ysh_run_procedure`, key], opts, activeState);
        }
      } break;

      case `envs`: {
        const environment = await applyEnvVariables(current.envs, opts, state);
        activeState.environment = {...activeState.environment, ...environment};
        action = makeCommandAction([`true`], opts, activeState);
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

function locateArgsVariableInSegment(segment: ArgumentSegment): boolean {
  switch (segment.type) {
    case `variable`: {
      return segment.name === `@` || segment.name === `#` || segment.name === `*` || Number.isFinite(parseInt(segment.name, 10)) || (!!segment.defaultValue && segment.defaultValue.some(arg => locateArgsVariableInArgument(arg)));
    } break;

    case `shell`: {
      return locateArgsVariable(segment.shell);
    } break;

    default: {
      return false;
    } break;
  }
}

function locateArgsVariableInArgument(arg: Argument): boolean {
  switch (arg.type) {
    case `redirection`: {
      return arg.args.some(arg => locateArgsVariableInArgument(arg));
    } break;

    case `argument`: {
      return arg.segments.some(segment => locateArgsVariableInSegment(segment));
    } break;

    default:
      throw new Error(`Unreacheable`);
  }
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
            hasArgs = chain.envs.some(env => env.args.some(arg => {
              return locateArgsVariableInArgument(arg);
            })) || chain.args.some(arg => {
              return locateArgsVariableInArgument(arg);
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
  cwd = npath.toPortablePath(process.cwd()),
  env = process.env,
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
  variables = {},
  glob = {
    isGlobPattern: fastGlob.isDynamicPattern,
    match: (pattern: string, {cwd, fs = xfs}) => fastGlob(pattern, {
      cwd: npath.fromPortablePath(cwd),
      // @ts-ignore: `fs` is wrapped in `PosixFS`
      fs: new PosixFS(fs),
    }),
  },
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

  const ast = parseShell(command, glob);

  // If the shell line doesn't use the args, inject it at the end of the
  // right-most command
  if (!locateArgsVariable(ast) && ast.length > 0 && args.length > 0) {
    let command = ast[ast.length - 1];
    while (command.then)
      command = command.then.line;

    let chain = command.chain;
    while (chain.then)
      chain = chain.then.chain;

    if (chain.type === `command`) {
      chain.args = chain.args.concat(args.map(arg => {
        return {
          type: `argument` as 'argument',
          segments: [{
            type: `text` as 'text',
            text: arg,
          }],
        };
      }));
    }
  }

  return await executeShellLine(ast, {
    args,
    builtins: normalizedBuiltins,
    initialStdin: stdin,
    initialStdout: stdout,
    initialStderr: stderr,
    glob,
  }, {
    cwd,
    environment: normalizedEnv,
    exitCode: null,
    procedures: {},
    stdin,
    stdout,
    stderr,
    variables: Object.assign(Object.create(variables), {
      [`?`]: 0,
    }),
  });
}
