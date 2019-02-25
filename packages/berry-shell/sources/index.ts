import {xfs}                                                              from '@berry/fslib';
import {CommandSegment, CommandChain, CommandLine, ShellLine, parseShell} from '@berry/parsers';
import execa                                                              from 'execa';
import {delimiter, posix}                                                 from 'path';
import {PassThrough, Readable, Writable}                                  from 'stream';
import {StringDecoder}                                                    from 'string_decoder';

export type ShellBuiltin = (args: Array<string>, commandOpts: ShellOptions, shellOpts: ShellOptions) => Promise<number>;

export type ShellOptions = {
  args: Array<string>,
  builtins: {[key: string]: ShellBuiltin},
  cwd: string,
  env: {[key: string]: string | undefined},
  exitCode: number | null,
  paths?: Array<string>,
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
  variables: {[key: string]: string},
};

export type ShellState = {
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
  variables: {[key: string]: string},
};

const BUILTINS = {
  async cd([target, ... rest]: Array<string>, commandOpts: ShellOptions, contextOpts: ShellOptions) {
    const resolvedTarget = posix.resolve(contextOpts.cwd, target);
    const stat = await xfs.statPromise(resolvedTarget);

    if (!stat.isDirectory()) {
      commandOpts.stderr.write(`cd: not a directory\n`);
      return 1;
    } else {
      contextOpts.cwd = target;
      return 0;
    }
  },

  pwd(args: Array<string>, commandOpts: ShellOptions, contextOpts: ShellOptions) {
    commandOpts.stdout.write(`${contextOpts.cwd}\n`);
    return 0;
  },

  true(args: Array<string>, commandOpts: ShellOptions, contextOpts: ShellOptions) {
    return 0;
  },

  false(args: Array<string>, commandOpts: ShellOptions, contextOpts: ShellOptions) {
    return 1;
  },

  exit([code, ... rest]: Array<string>, commandOpts: ShellOptions, contextOpts: ShellOptions) {
    return contextOpts.exitCode = parseInt(code, 10);
  },

  echo(args: Array<string>, commandOpts: ShellOptions, contextOpts: ShellOptions) {
    commandOpts.stdout.write(`${args.join(` `)}\n`);
    return 0;
  },

  async command([ident, ... rest]: Array<string>, {cwd, env: commandEnv, stdin, stdout, stderr}: ShellOptions, contextOpts: ShellOptions) {
    if (typeof ident === `undefined`)
      return 0;

    const stdio: Array<any> = [`pipe`, `pipe`, `pipe`];

    if (stdin === process.stdin)
      stdio[0] = stdin;
    if (stdout === process.stdout)
      stdio[1] = stdout;
    if (stderr === process.stderr)
      stdio[2] = stderr;

    const env: {[key: string]: string} = {};

    for (const key of Object.keys(commandEnv))
      env[key.toUpperCase()] = commandEnv[key] as string;

    if (env.PATH && posix.delimiter !== delimiter)
      env.PATH = env.PATH.replace(new RegExp(posix.delimiter, `g`), delimiter);
    
    const subprocess = execa(ident, rest, {
      preferLocal: false,
      cwd,
      stdio,
      env,
    });

    if (stdin !== process.stdin)
      stdin.pipe(subprocess.stdin);
    if (stdout !== process.stdout)
      subprocess.stdout.pipe(stdout, {end: false});
    if (stderr !== process.stderr)
      subprocess.stderr.pipe(stderr, {end: false});

    return new Promise(resolve => {
      subprocess.on(`error`, error => {
        // @ts-ignore
        switch (error.code) {
          case `ENOENT`: {
            stderr.write(`command not found: ${ident}\n`);
            resolve(127);
          } break;
          case `EACCESS`: {
            stderr.write(`permission denied: ${ident}\n`);
            resolve(128);
          } break;
          default: {
            stderr.write(`uncaught error: ${error.message}\n`);
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
    });
  },
};

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

async function runShellAst(ast: ShellLine, opts: ShellOptions, {stdin, stdout, stderr, variables}: ShellState) {
  const {args, builtins, cwd} = opts;
  const errors: Array<Error> = [];

  async function executeSubshell(ast: ShellLine) {
    let text = ``;

    const decoder = new StringDecoder();
    const stdout = new PassThrough();

    stdout.on(`data`, chunk => {
      text += decoder.write(chunk);
    });

    stdout.on(`end`, () => {
      text += decoder.end();
    });

    await runShellAst(ast, opts, {stdin, stdout, stderr, variables});

    return text.replace(/[\r\n]+$/, ``);
  }

  async function interpolateArguments(commandArgs: Array<Array<CommandSegment>>, variables: {[key: string]: string}) {
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
              const raw = await executeSubshell(segment.shell);
              if (segment.quoted) {
                push(raw);
              } else for (const part of split(raw)) {
                pushAndClose(part);
              }
            } break;

            case `variable`: {
              switch (segment.name) {

                case `#`: {
                  push(String(args.length));
                } break;

                case `@`: {
                  if (segment.quoted) {
                    for (const raw of args) {
                      pushAndClose(raw);
                    }
                  } else for (const raw of args) {
                    for (const part of split(raw)) {
                      pushAndClose(part);
                    }
                  }
                } break;

                case `*`: {
                  const raw = args.join(` `);
                  if (segment.quoted) {
                    push(raw);
                  } else for (const part of split(raw)) {
                    pushAndClose(part);
                  }
                } break;

                default: {
                  const argIndex = parseInt(segment.name, 10);

                  if (Number.isFinite(argIndex)) {
                    if (!(argIndex >= 0 && argIndex < args.length)) {
                      throw new Error(`Unbound argument #${argIndex}`);
                    } else {
                      push(args[argIndex]);
                    }
                  } else {
                    if (!(segment.name in variables)) {
                      throw new Error(`Unbound variable "${segment.name}"`);
                    } else {
                      push(variables[segment.name]);
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
   * Unroll a command chain. A command chain is a list of commands linked
   * together thanks to the use of either of the `|` or `|&` operators:
   * 
   * $ cat hello | grep world | grep -v foobar
   * 
   * This function returns a callback that, when called, will simultaneously
   * start all the processes from the command chain starting from the last
   * one (we must be careful not to start by the first one, otherwise any
   * data it would write before its followup spawn could be lost).
   * 
   * The return value of this callback is an array of promises that resolve to
   * the exit code of the respective process in the command chain.
   */

  async function unrollCommandChain(node: CommandChain, {stdin, stdout, stderr, variables}: ShellState) {
    let next = (promises: Array<Promise<number>>) => {};
    let closeStreams = () => {};

    // If the node as a followup, then we first need to replace its stdout and
    // stderr streams in order to forward them to the next command
    if (node.then) {
      const pipe = new PassThrough();

      next = await unrollCommandChain(node.then.chain, {stdin: pipe, stdout, stderr, variables});
      closeStreams = () => pipe.end();

      switch (node.then.type) {
        case `|&`: {
          stdout = pipe;
          stderr = pipe;
        } break;

        case `|`: {
          stdout = pipe;
        } break;
      }
    }

    const commandArgs = node.type === `command`
      ? await interpolateArguments(node.args, variables)
      : null;

    return (promises: Array<Promise<number>> = []) => {
      next(promises);

      if (opts.exitCode !== null)
        return promises;

      let promise;

      switch (node.type) {
        // If the node is a subshell, we just have to recurse and execute its AST
        // after having updated the stdin/stdout/stderr state.
        case `subshell`: {
          promise = runShellAst(node.subshell, opts, {stdin, stdout, stderr, variables: Object.create(variables)});
        } break;

        // If the node is a simple command, we interpolate its arguments with the
        // available variables then call the matching builtin (if no builtin
        // matches we default to "command", just like regular shells do).
        case `command`: {
          if (commandArgs === null) {
            throw new Error(`Assertion failed: The arguments should have been interpolated`);
          } else if (commandArgs.length === 0) {
            promise = Promise.resolve(0);
          } else if (Object.prototype.hasOwnProperty.call(builtins, commandArgs[0])) {
            promise = Promise.resolve(builtins[commandArgs[0]](commandArgs.slice(1), {... opts, stdin, stdout, stderr}, opts));
          } else {
            promise = Promise.resolve(builtins.command(commandArgs, {... opts, stdin, stdout, stderr}, opts));
          }
        } break;

        default: {
          // @ts-ignore
          throw new Error(`Unsupported command type: "${node.type}"`);
        } break;
      }

      promises.push(promise.then(result => {
        closeStreams();
        return result;
      }, error => {
        closeStreams();
        throw error;
      }));

      return promises;
    };
  }

  /**
   * Execute a command chain and return the exit code for the right-most
   * command (so `false | true` would return 0 and `true | false` would
   * return 1).
   */
  async function executeCommandChain(node: CommandChain, state: ShellState) {
    const unrolledExecution = await unrollCommandChain(node, state);
    const exitCodes = await Promise.all(unrolledExecution());

    if (exitCodes.length > 0) {
      return exitCodes[exitCodes.length - 1];
    } else {
      return 0;
    }
  }

  /**
   * Execute a command line. A command line is a list of command shells linked
   * together thanks to the use of either of the `||` or `&&` operators.
   */
  async function executeCommandLine(node: CommandLine, state: ShellState): Promise<number> {
    if (!node.then) {
      return await executeCommandChain(node.chain, state);
    } else {
      const code = await executeCommandChain(node.chain, state);

      if (opts.exitCode !== null)
        return opts.exitCode;

      state.variables[`?`] = String(code);

      switch (node.then.type) {
        case `&&`: {
          if (code === 0) {
            return await executeCommandLine(node.then.line, state);
          } else {
            return code;
          }
        } break;

        case `||`: {
          if (code !== 0) {
            return await executeCommandLine(node.then.line, state);
          } else {
            return code;
          }
        } break;

        default: {
          throw new Error(`Unsupported command type: "${node.then.type}"`);
        } break;
      }
    }
  }

  async function executeShellLine(node: ShellLine, state: ShellState) {
    let lastExitCode = 0;

    for (const command of node) {
      const stdin = state.stdin;

      lastExitCode = await executeCommandLine(command, state);
      
      state.variables[`?`] = String(lastExitCode);

      if (opts.exitCode !== null) {
        return opts.exitCode;
      }
    }

    return lastExitCode;
  }

  return executeShellLine(ast, {stdin, stdout, stderr, variables});
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

export async function runShell(command: string, {
  args = [],
  builtins = {},
  cwd = process.cwd(),
  env: userEnv = process.env,
  paths = [],
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
  variables = {},
}: Partial<ShellOptions> = {}) {
  const env: {[key: string]: string} = {};

  for (const key of Object.keys(userEnv))
    env[key.toUpperCase()] = userEnv[key] as string;

  if (paths.length > 0)
    env.PATH = env.PATH
      ? `${paths.join(posix.delimiter)}${posix.delimiter}${env.PATH}`
      : `${paths.join(posix.delimiter)}`;

  const ast = parseShell(command);

  // Inject the default builtins
  builtins = Object.assign({}, builtins, BUILTINS);

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

  return await runShellAst(ast, {
    args,
    builtins,
    cwd,
    env,
    exitCode: null,
    stdin,
    stdout,
    stderr,
    variables,
  }, {
    stdin,
    stdout,
    stderr,
    variables: Object.assign(Object.create(variables), {
      [`?`]: 0,
    }),
  });
}
