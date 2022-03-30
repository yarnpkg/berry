import {PortablePath, npath, ppath, FakeFS, NodeFS}                                                         from '@yarnpkg/fslib';
import {Argument, ArgumentSegment, CommandChain, CommandLine, ShellLine, parseShell, stringifyCommandChain} from '@yarnpkg/parsers';
import {EnvSegment, ArithmeticExpression, ArithmeticPrimary}                                                from '@yarnpkg/parsers';
import chalk                                                                                                from 'chalk';
import {homedir}                                                                                            from 'os';
import {PassThrough, Readable, Writable}                                                                    from 'stream';
import {promisify}                                                                                          from 'util';

import {ShellError}                                                                                         from './errors';
import * as globUtils                                                                                       from './globUtils';
import {createOutputStreamsWithPrefix, makeBuiltin, makeProcess}                                            from './pipe';
import {Handle, ProcessImplementation, ProtectedStream, Stdio, start, Pipe}                                 from './pipe';

const setTimeoutPromise = promisify(setTimeout);

export {globUtils, ShellError};

export type Glob = globUtils.Glob;

export type UserOptions = {
  baseFs: FakeFS<PortablePath>;
  builtins: {[key: string]: ShellBuiltin};
  cwd: PortablePath;
  env: {[key: string]: string | undefined};
  stdin: Readable | null;
  stdout: Writable;
  stderr: Writable;
  variables: {[key: string]: string};
  glob: globUtils.Glob;
};

export type ShellBuiltin = (
  args: Array<string>,
  opts: ShellOptions,
  state: ShellState,
) => Promise<number>;

export type ShellOptions = {
  args: Array<string>;
  baseFs: FakeFS<PortablePath>;
  builtins: Map<string, ShellBuiltin>;
  initialStdin: Readable;
  initialStdout: Writable;
  initialStderr: Writable;
  glob: globUtils.Glob;
};

export type ShellState = {
  cwd: PortablePath;
  environment: {[key: string]: string};
  exitCode: number | null;
  procedures: {[key: string]: ProcessImplementation};
  stdin: Readable;
  stdout: Writable;
  stderr: Writable;
  variables: {[key: string]: string};
  nextBackgroundJobIndex: number;
  backgroundJobs: Array<Promise<unknown>>;
};

enum StreamType {
  Readable = 0b01,
  Writable = 0b10,
}

function getFileDescriptorStream(fd: number, type: StreamType, state: ShellState) {
  const stream = new PassThrough({autoDestroy: true});

  switch (fd) {
    case Pipe.STDIN: {
      if ((type & StreamType.Readable) === StreamType.Readable)
        state.stdin.pipe(stream, {end: false});

      if ((type & StreamType.Writable) === StreamType.Writable && state.stdin instanceof Writable) {
        stream.pipe(state.stdin, {end: false});
      }
    } break;

    case Pipe.STDOUT: {
      if ((type & StreamType.Readable) === StreamType.Readable)
        state.stdout.pipe(stream, {end: false});

      if ((type & StreamType.Writable) === StreamType.Writable) {
        stream.pipe(state.stdout, {end: false});
      }
    } break;

    case Pipe.STDERR: {
      if ((type & StreamType.Readable) === StreamType.Readable)
        state.stderr.pipe(stream, {end: false});

      if ((type & StreamType.Writable) === StreamType.Writable) {
        stream.pipe(state.stderr, {end: false});
      }
    } break;

    default: {
      throw new ShellError(`Bad file descriptor: "${fd}"`);
    }
  }

  return stream;
}

function cloneState(state: ShellState, mergeWith: Partial<ShellState> = {}) {
  const newState = {...state, ...mergeWith};

  newState.environment = {...state.environment, ...mergeWith.environment};
  newState.variables = {...state.variables, ...mergeWith.variables};

  return newState;
}

const BUILTINS = new Map<string, ShellBuiltin>([
  [`cd`, async ([target = homedir(), ...rest]: Array<string>, opts: ShellOptions, state: ShellState) => {
    const resolvedTarget = ppath.resolve(state.cwd, npath.toPortablePath(target));
    const stat = await opts.baseFs.statPromise(resolvedTarget).catch(error => {
      throw error.code === `ENOENT`
        ? new ShellError(`cd: no such file or directory: ${target}`)
        : error;
    });

    if (!stat.isDirectory())
      throw new ShellError(`cd: not a directory: ${target}`);

    state.cwd = resolvedTarget;
    return 0;
  }],

  [`pwd`, async (args: Array<string>, opts: ShellOptions, state: ShellState) => {
    state.stdout.write(`${npath.fromPortablePath(state.cwd)}\n`);
    return 0;
  }],

  [`:`, async (args: Array<string>, opts: ShellOptions, state: ShellState) => {
    return 0;
  }],

  [`true`, async (args: Array<string>, opts: ShellOptions, state: ShellState) => {
    return 0;
  }],

  [`false`, async (args: Array<string>, opts: ShellOptions, state: ShellState) => {
    return 1;
  }],

  [`exit`, async ([code, ...rest]: Array<string>, opts: ShellOptions, state: ShellState) => {
    return state.exitCode = parseInt(code ?? state.variables[`?`], 10);
  }],

  [`echo`, async (args: Array<string>, opts: ShellOptions, state: ShellState) => {
    state.stdout.write(`${args.join(` `)}\n`);
    return 0;
  }],

  [`sleep`, async ([time]: Array<string>, opts: ShellOptions, state: ShellState) => {
    if (typeof time === `undefined`)
      throw new ShellError(`sleep: missing operand`);

    // TODO: make it support unit suffixes
    const seconds = Number(time);
    if (Number.isNaN(seconds))
      throw new ShellError(`sleep: invalid time interval '${time}'`);

    return await setTimeoutPromise(1000 * seconds, 0);
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
    let stderr = state.stderr;

    const inputs: Array<() => Readable> = [];
    const outputs: Array<Writable> = [];
    const errors: Array<Writable> = [];

    let t = 0;

    while (args[t] !== `--`) {
      const key = args[t++];
      const {type, fd} = JSON.parse(key);

      const pushInput = (readableFactory: () => Readable) => {
        switch (fd) {
          case null:
          case 0: {
            inputs.push(readableFactory);
          } break;

          default:
            throw new Error(`Unsupported file descriptor: "${fd}"`);
        }
      };

      const pushOutput = (writable: Writable) => {
        switch (fd) {
          case null:
          case 1: {
            outputs.push(writable);
          } break;

          case 2: {
            errors.push(writable);
          } break;

          default:
            throw new Error(`Unsupported file descriptor: "${fd}"`);
        }
      };

      const count = Number(args[t++]);
      const last = t + count;

      for (let u = t; u < last; ++t, ++u) {
        switch (type) {
          case `<`: {
            pushInput(() => {
              return opts.baseFs.createReadStream(ppath.resolve(state.cwd, npath.toPortablePath(args[u])));
            });
          } break;
          case `<<<`: {
            pushInput(() => {
              const input = new PassThrough();
              process.nextTick(() => {
                input.write(`${args[u]}\n`);
                input.end();
              });
              return input;
            });
          } break;
          case `<&`: {
            pushInput(() => getFileDescriptorStream(Number(args[u]), StreamType.Readable, state));
          } break;

          case `>`:
          case `>>`: {
            const outputPath = ppath.resolve(state.cwd, npath.toPortablePath(args[u]));
            if (outputPath === `/dev/null`) {
              pushOutput(
                new Writable({
                  autoDestroy: true,
                  emitClose: true,
                  write(chunk, encoding, callback) {
                    setImmediate(callback);
                  },
                }),
              );
            } else {
              pushOutput(opts.baseFs.createWriteStream(outputPath, type === `>>` ? {flags: `a`} : undefined));
            }
          } break;
          case `>&`: {
            pushOutput(getFileDescriptorStream(Number(args[u]), StreamType.Writable, state));
          } break;

          default: {
            throw new Error(`Assertion failed: Unsupported redirection type: "${type}"`);
          }
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

    if (errors.length > 0) {
      const pipe = new PassThrough();
      stderr = pipe;

      for (const error of errors) {
        pipe.pipe(error);
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
      return new Promise<void>((resolve, reject) => {
        output.on(`error`, error => {
          reject(error);
        });
        output.on(`close`, () => {
          resolve();
        });
        output.end();
      });
    }));

    // Close all the errors (since the shell never closes the error stream)
    await Promise.all(errors.map(err => {
      // Wait until the error got flushed to the disk
      return new Promise<void>((resolve, reject) => {
        err.on(`error`, error => {
          reject(error);
        });
        err.on(`close`, () => {
          resolve();
        });
        err.end();
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

function split(raw: string) {
  return raw.match(/[^ \r\n\t]+/g) || [];
}

async function evaluateVariable(segment: ArgumentSegment & {type: `variable`}, opts: ShellOptions, state: ShellState, push: (value: string) => void, pushAndClose = push) {
  switch (segment.name) {
    case `$`: {
      push(String(process.pid));
    } break;

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

    case `PPID`: {
      push(String(process.ppid));
    } break;

    case `RANDOM`: {
      push(String(Math.floor(Math.random() * 32768)));
    } break;

    default: {
      const argIndex = parseInt(segment.name, 10);

      let raw;
      if (Number.isFinite(argIndex)) {
        if (argIndex >= 0 && argIndex < opts.args.length) {
          raw = opts.args[argIndex];
        } else if (segment.defaultValue) {
          raw = (await interpolateArguments(segment.defaultValue, opts, state)).join(` `);
        } else if (segment.alternativeValue) {
          raw = (await interpolateArguments(segment.alternativeValue, opts, state)).join(` `);
        } else {
          throw new ShellError(`Unbound argument #${argIndex}`);
        }
      } else {
        if (Object.prototype.hasOwnProperty.call(state.variables, segment.name)) {
          raw = state.variables[segment.name];
        } else if (Object.prototype.hasOwnProperty.call(state.environment, segment.name)) {
          raw = state.environment[segment.name];
        } else if (segment.defaultValue) {
          raw = (await interpolateArguments(segment.defaultValue, opts, state)).join(` `);
        } else {
          throw new ShellError(`Unbound variable "${segment.name}"`);
        }
      }

      if (typeof raw !== `undefined` && segment.alternativeValue)
        raw = (await interpolateArguments(segment.alternativeValue, opts, state)).join(` `);

      if (segment.quoted) {
        push(raw);
      } else {
        const parts = split(raw);

        for (let t = 0; t < parts.length - 1; ++t)
          pushAndClose(parts[t]);

        const part = parts[parts.length - 1];
        if (typeof part !== `undefined`) {
          push(part);
        }
      }
    } break;
  }
}

const operators = {
  addition: (left: number, right: number) => left + right,
  subtraction: (left: number, right: number) => left - right,
  multiplication: (left: number, right: number) => left * right,
  division: (left: number, right: number) => Math.trunc(left / right),
};

async function evaluateArithmetic(arithmetic: ArithmeticExpression, opts: ShellOptions, state: ShellState): Promise<number> {
  if (arithmetic.type === `number`) {
    if (!Number.isInteger(arithmetic.value)) {
      // ZSH allows non-integers, while bash throws at the parser level (unrecoverable)
      throw new Error(`Invalid number: "${arithmetic.value}", only integers are allowed`);
    } else {
      return arithmetic.value;
    }
  } else if (arithmetic.type === `variable`) {
    const parts: Array<string> = [];
    await evaluateVariable({...arithmetic, quoted: true}, opts, state, result => parts.push(result));

    const number = Number(parts.join(` `));

    if (Number.isNaN(number)) {
      return evaluateArithmetic({type: `variable`, name: parts.join(` `)}, opts, state);
    } else {
      return evaluateArithmetic({type: `number`, value: number}, opts, state);
    }
  } else {
    return operators[arithmetic.type](
      await evaluateArithmetic(arithmetic.left, opts, state),
      await evaluateArithmetic(arithmetic.right, opts, state),
    );
  }
}

async function interpolateArguments(commandArgs: Array<Argument>, opts: ShellOptions, state: ShellState) {
  const redirections = new Map();

  const interpolated: Array<string> = [];
  let interpolatedSegments: Array<string> = [];

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

  const redirect = (type: string, fd: number | null, target: string) => {
    const key = JSON.stringify({type, fd});

    let targets = redirections.get(key);

    if (typeof targets === `undefined`)
      redirections.set(key, targets = []);

    targets.push(target);
  };

  for (const commandArg of commandArgs) {
    let isGlob = false;

    switch (commandArg.type) {
      case `redirection`: {
        const interpolatedArgs = await interpolateArguments(commandArg.args, opts, state);
        for (const interpolatedArg of interpolatedArgs) {
          redirect(commandArg.subtype, commandArg.fd, interpolatedArg);
        }
      } break;

      case `argument`: {
        for (const segment of commandArg.segments) {
          switch (segment.type) {
            case `text`: {
              push(segment.text);
            } break;

            case `glob`: {
              push(segment.pattern);
              isGlob = true;
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
              await evaluateVariable(segment, opts, state, push, pushAndClose);
            } break;

            case `arithmetic`: {
              push(String(await evaluateArithmetic(segment.arithmetic, opts, state)));
            } break;
          }
        }
      } break;
    }

    close();

    if (isGlob) {
      const pattern = interpolated.pop();
      if (typeof pattern === `undefined`)
        throw new Error(`Assertion failed: Expected a glob pattern to have been set`);

      const matches = await opts.glob.match(pattern, {cwd: state.cwd, baseFs: opts.baseFs});
      if (matches.length === 0) {
        const braceExpansionNotice = globUtils.isBraceExpansion(pattern)
          ? `. Note: Brace expansion of arbitrary strings isn't currently supported. For more details, please read this issue: https://github.com/yarnpkg/berry/issues/22`
          : ``;

        throw new ShellError(`No matches found: "${pattern}"${braceExpansionNotice}`);
      }

      for (const match of matches.sort()) {
        pushAndClose(match);
      }
    }
  }

  if (redirections.size > 0) {
    const redirectionArgs: Array<string> = [];

    for (const [key, targets] of redirections.entries())
      redirectionArgs.splice(redirectionArgs.length, 0, key, String(targets.length), ...targets);

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
    const {
      stdin: initialStdin,
      stdout: initialStdout,
      stderr: initialStderr,
    } = state;

    state.stdin = stdin;
    state.stdout = stdout;
    state.stderr = stderr;

    try {
      return await builtin(rest, opts, state);
    } finally {
      state.stdin = initialStdin;
      state.stdout = initialStdout;
      state.stderr = initialStderr;
    }
  });
}

function makeSubshellAction(ast: ShellLine, opts: ShellOptions, state: ShellState) {
  return (stdio: Stdio) => {
    const stdin = new PassThrough();
    const promise = executeShellLine(ast, opts, cloneState(state, {stdin}));

    return {stdin, promise};
  };
}

function makeGroupAction(ast: ShellLine, opts: ShellOptions, state: ShellState) {
  return (stdio: Stdio) => {
    const stdin = new PassThrough();
    const promise = executeShellLine(ast, opts, state);

    return {stdin, promise};
  };
}

function makeActionFromProcedure(procedure: ProcessImplementation, args: Array<string>, opts: ShellOptions, activeState: ShellState) {
  if (args.length === 0) {
    return procedure;
  } else {
    let key;
    do {
      key = String(Math.random());
    } while (Object.prototype.hasOwnProperty.call(activeState.procedures, key));

    activeState.procedures = {...activeState.procedures};
    activeState.procedures[key] = procedure;

    return makeCommandAction([...args, `__ysh_run_procedure`, key], opts, activeState);
  }
}

async function executeCommandChainImpl(node: CommandChain, opts: ShellOptions, state: ShellState) {
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

        action = makeActionFromProcedure(procedure, args, opts, activeState);
      } break;

      case `group`: {
        const args = await interpolateArguments(current.args, opts, state);

        const procedure = makeGroupAction(current.group, opts, activeState);

        action = makeActionFromProcedure(procedure, args, opts, activeState);
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
        throw new Error(`Assertion failed: The execution pipeline should have been setup`);

      // Otherwise, depending on the exaxct pipe type, we either pipe stdout
      // only or stdout and stderr
      switch (pipeType) {
        case `|`: {
          execution = execution.pipeTo(action, Pipe.STDOUT);
        } break;

        case `|&`: {
          execution = execution.pipeTo(action, Pipe.STDOUT | Pipe.STDERR);
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

async function executeCommandChain(node: CommandChain, opts: ShellOptions, state: ShellState, {background = false}: {background?: boolean} = {}) {
  function getColorizer(index: number) {
    const colors = [`#2E86AB`, `#A23B72`, `#F18F01`, `#C73E1D`, `#CCE2A3`];
    const colorName = colors[index % colors.length];

    return chalk.hex(colorName);
  }

  if (background) {
    const index = state.nextBackgroundJobIndex++;
    const colorizer = getColorizer(index);
    const rawPrefix = `[${index}]`;
    const prefix = colorizer(rawPrefix);

    const {stdout, stderr} = createOutputStreamsWithPrefix(state, {prefix});

    state.backgroundJobs.push(
      executeCommandChainImpl(node, opts, cloneState(state, {stdout, stderr}))
        .catch(error => stderr.write(`${error.message}\n`))
        .finally(() => {
          if ((state.stdout as any).isTTY) {
            state.stdout.write(`Job ${prefix}, '${colorizer(stringifyCommandChain(node))}' has ended\n`);
          }
        }),
    );

    return 0;
  }

  return await executeCommandChainImpl(node, opts, state);
}

/**
 * Execute a command line. A command line is a list of command shells linked
 * together thanks to the use of either of the `||` or `&&` operators.
 */
async function executeCommandLine(node: CommandLine, opts: ShellOptions, state: ShellState, {background = false}: {background?: boolean} = {}): Promise<number> {
  let code!: number;
  const setCode = (newCode: number) => {
    code = newCode;

    // We must update $?, which always contains the exit code from
    // the right-most command
    state.variables[`?`] = String(newCode);
  };

  const executeChain = async (line: CommandLine) => {
    try {
      return await executeCommandChain(line.chain, opts, state, {background: background && typeof line.then === `undefined`});
    } catch (error) {
      if (!(error instanceof ShellError))
        throw error;

      state.stderr.write(`${error.message}\n`);

      return 1;
    }
  };

  setCode(await executeChain(node));

  // We use a loop because we must make sure that we respect
  // the left associativity of lists, as per the bash spec.
  // (e.g. `inexistent && echo yes || echo no` must be
  // the same as `{inexistent && echo yes} || echo no`)
  while (node.then) {
    // If the execution aborted (usually through "exit"), we must bailout
    if (state.exitCode !== null)
      return state.exitCode;

    switch (node.then.type) {
      case `&&`: {
        if (code === 0) {
          setCode(await executeChain(node.then.line));
        }
      } break;

      case `||`: {
        if (code !== 0) {
          setCode(await executeChain(node.then.line));
        }
      } break;

      default: {
        throw new Error(`Assertion failed: Unsupported command type: "${node.then.type}"`);
      }
    }

    node = node.then.line;
  }

  return code;
}

async function executeShellLine(node: ShellLine, opts: ShellOptions, state: ShellState) {
  const originalBackgroundJobs = state.backgroundJobs;
  state.backgroundJobs = [];

  let rightMostExitCode = 0;

  for (const {command, type} of node) {
    rightMostExitCode = await executeCommandLine(command, opts, state, {background: type === `&`});

    // If the execution aborted (usually through "exit"), we must bailout
    if (state.exitCode !== null)
      return state.exitCode;

    // We must update $?, which always contains the exit code from
    // the right-most command
    state.variables[`?`] = String(rightMostExitCode);
  }

  await Promise.all(state.backgroundJobs);
  state.backgroundJobs = originalBackgroundJobs;

  return rightMostExitCode;
}

function locateArgsVariableInSegment(segment: ArgumentSegment | ArithmeticPrimary): boolean {
  switch (segment.type) {
    case `variable`: {
      return segment.name === `@` || segment.name === `#` || segment.name === `*` || Number.isFinite(parseInt(segment.name, 10)) || (`defaultValue` in segment && !!segment.defaultValue && segment.defaultValue.some(arg => locateArgsVariableInArgument(arg))) || (`alternativeValue` in segment && !!segment.alternativeValue && segment.alternativeValue.some(arg => locateArgsVariableInArgument(arg)));
    }
    case `arithmetic`: {
      return locateArgsVariableInArithmetic(segment.arithmetic);
    }
    case `shell`: {
      return locateArgsVariable(segment.shell);
    }
    default: {
      return false;
    }
  }
}

function locateArgsVariableInArgument(arg: Argument): boolean {
  switch (arg.type) {
    case `redirection`: {
      return arg.args.some(arg => locateArgsVariableInArgument(arg));
    }
    case `argument`: {
      return arg.segments.some(segment => locateArgsVariableInSegment(segment));
    }
    default:
      throw new Error(`Assertion failed: Unsupported argument type: "${(arg as Argument).type}"`);
  }
}

function locateArgsVariableInArithmetic(arg: ArithmeticExpression): boolean {
  switch (arg.type) {
    case `variable`: {
      return locateArgsVariableInSegment(arg);
    }
    case `number`: {
      return false;
    }
    default:
      return locateArgsVariableInArithmetic(arg.left) || locateArgsVariableInArithmetic(arg.right);
  }
}

function locateArgsVariable(node: ShellLine): boolean {
  return node.some(({command}) => {
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
  baseFs = new NodeFS(),
  builtins = {},
  cwd = npath.toPortablePath(process.cwd()),
  env = process.env,
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
  variables = {},
  glob = globUtils,
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
    let {command} = ast[ast.length - 1];
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
    baseFs,
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
    variables: Object.assign({}, variables, {
      [`?`]: 0,
    }),
    nextBackgroundJobIndex: 1,
    backgroundJobs: [],
  });
}
