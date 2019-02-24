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
      subprocess.stdout.pipe(stdout);
    if (stderr !== process.stderr)
      subprocess.stderr.pipe(stderr);

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

function deepCompare(a: any, b: any) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function runShellAst(ast: ShellLine, opts: ShellOptions) {
  const {args, builtins, cwd, stdin, stdout, stderr, variables} = opts;
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

    await runShellAst(ast, {... opts, stdout});

    return text.replace(/[\r\n]+$/, ``);
  }

  async function interpolateArguments(commandArgs: Array<Array<CommandSegment>>) {
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
                    if (!Object.prototype.hasOwnProperty.call(variables, segment.name)) {
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

  async function unrollCommandChain(node: CommandChain, {stdin, stdout, stderr}: {stdin: Readable, stdout: Writable, stderr: Writable}) {
    let next = (promises: Array<Promise<number>>) => {};

    if (node.then) {
      const pipe = new PassThrough();

      next = await unrollCommandChain(node.then.chain, {stdin: pipe, stdout, stderr});

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

    if (node.subshell) {
      return (promises: Array<Promise<number>> = []) => {
        next(promises);

        if (opts.exitCode === null)
          promises.push(runShellAst(node.subshell, {... opts, stdin, stdout, stderr}));

        return promises;
      };
    } else if (node.args) {
      const args = await interpolateArguments(node.args);

      if (args.length < 1)
        return () => [];

      const ident = args[0];
      const builtin = Object.prototype.hasOwnProperty.call(builtins, ident)
        ? (commandOpts: ShellOptions) => builtins[ident](args.slice(1), commandOpts, opts)
        : (commandOpts: ShellOptions) => builtins.command(args, commandOpts, opts);

      return (promises: Array<Promise<number>> = []) => {
        next(promises);

        if (opts.exitCode === null)
          promises.push(builtin({... opts, stdin, stdout, stderr}));

        return promises;
      }
    }
  }

  async function executeCommandChain(node: CommandChain) {
    const unrolledExecution = await unrollCommandChain(node, {stdin, stdout, stderr});
    const exitCodes = await Promise.all(unrolledExecution());

    if (exitCodes.length > 0) {
      return exitCodes[exitCodes.length - 1];
    } else {
      return 0;
    }
  }

  async function executeCommandLine(node: CommandLine): Promise<number> {
    if (!node.then) {
      return await executeCommandChain(node.chain);
    } else switch (node.then.type) {
      case `&&`: {
        const code = await executeCommandChain(node.chain);

        if (opts.exitCode !== null)
          return opts.exitCode;

        if (code === 0) {
          return await executeCommandLine(node.then.line);
        } else {
          return code;
        }
      } break;

      case `||`: {
        const code = await executeCommandChain(node.chain);

        if (opts.exitCode !== null)
          return opts.exitCode;

        if (code !== 0) {
          return await executeCommandLine(node.then.line);
        } else {
          return code;
        }
      } break;

      default: {
        throw new Error(`Unsupported command type: "${node.then.type}"`);
      } break;
    }
  }

  async function executeShellLine(node: ShellLine) {
    let lastExitCode = 0;

    for (const command of node) {
      lastExitCode = await executeCommandLine(command);
      
      if (opts.exitCode !== null) {
        return opts.exitCode;
      }
    }
    
    return lastExitCode;
  }

  return executeShellLine(ast);
}

function locateArgsVariable(node: ShellLine): boolean {
  return node.some(command => {
    while (command) {
      let chain = command.chain;

      while (chain) {
        const hasArgs = chain.args.some(arg => {
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

    chain.args = chain.args.concat(args.map(arg => {
      return [arg];
    }));
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
  });
}
