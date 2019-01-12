import {CommandSegment, CommandChain, CommandLine, ShellLine, parseShell} from '@berry/parsers';
import execa                                                              from 'execa';
import {stat}                                                             from 'fs';
import {delimiter, posix}                                                 from 'path';
import {PassThrough, Readable, Writable}                                  from 'stream';
import {StringDecoder}                                                    from 'string_decoder';
import {promisify}                                                        from 'util';

const statP = promisify(stat);

export type ShellOptions = {
  args: Array<string>,
  builtins: {[key: string]: (args: Array<string>, commandOpts: ShellOptions, shellOpts: ShellOptions) => Promise<void>},
  cwd: string,
  env: {[key: string]: string | undefined},
  paths?: Array<string>,
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
  variables: {[key: string]: string},
};

const BUILTINS = {
  async cd([target, ... rest]: Array<string>, commandOpts: ShellOptions, contextOpts: ShellOptions) {
    target = posix.resolve(contextOpts.cwd, target);

    const stat = await statP(target);

    if (!stat.isDirectory()) {
      commandOpts.stderr.write(`cd: not a directory\n`);
      throw new Error(`cd: not a directory`);
    };

    contextOpts.cwd = target;
  },

  pwd([target, ... rest]: Array<string>, commandOpts: ShellOptions, contextOpts: ShellOptions) {
    commandOpts.stdout.write(`${contextOpts.cwd}\n`);
  },

  async command([ident, ... rest]: Array<string>, {cwd, env: commandEnv, stdin, stdout, stderr}: ShellOptions, contextOpts: ShellOptions) {
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

    return new Promise((resolve, reject) => {
      subprocess.on(`error`, error => {
        // @ts-ignore
        switch (error.code) {
          case `ENOENT`: {
            stderr.write(`command not found: ${ident}\n`);
          } break;
          default: {
            stderr.write(`uncaught error: ${error.message}\n`);
          } break;
        }
        reject(error);
      });
      subprocess.on(`exit`, code => {
        if (code === 0) {
          resolve();
        } else {
          reject(Object.assign(new Error(`Process exited with error code ${code}`), {
            cmd: `ok`, code,
          }));
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

    return text;
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
                  if (!Object.prototype.hasOwnProperty.call(variables, segment.name))
                    throw new Error(`Unset variable "${segment.name}"`);
                  interpolated[interpolated.length - 1] += variables[segment.name];
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
    let next = (promises: Array<Promise<void>>) => {};

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

    const args = await interpolateArguments(node.args);

    if (args.length < 1)
      return () => {};

    const ident = args[0];
    const builtin = Object.prototype.hasOwnProperty.call(builtins, ident)
      ? (commandOpts: ShellOptions) => builtins[ident](args.slice(1), commandOpts, opts)
      : (commandOpts: ShellOptions) => builtins.command(args, commandOpts, opts);

    return (promises: Array<Promise<void>>) => {
      next(promises);
      promises.push(builtin({... opts, stdin, stdout, stderr}));
    };
  }

  async function executeCommandChain(node: CommandChain) {
    const unrolledExecution = await unrollCommandChain(node, {stdin, stdout, stderr});

    const promises: Array<Promise<void>> = [];
    unrolledExecution(promises);

    await Promise.all(promises);
  }

  async function executeCommandLine(node: CommandLine) {
    if (!node.then) {
      await executeCommandChain(node.chain);
    } else switch (node.then.type) {
      case `&&`: {
        await executeCommandChain(node.chain);
        await executeCommandLine(node.then.line);
      } break;

      case `||`: {
        try {
          await executeCommandChain(node.chain);
        } catch (error) {
          await executeCommandLine(node.then.line);
        }
      } break;
    }
  }

  async function executeShellLine(node: ShellLine) {
    for (const command of node) {
      await executeCommandLine(command);
    }
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
                return segment.name === `@` || segment.name === `#` || segment.name === `*`;
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

  await runShellAst(ast, {
    args,
    builtins,
    cwd,
    env,
    stdin,
    stdout,
    stderr,
    variables,
  });
}
