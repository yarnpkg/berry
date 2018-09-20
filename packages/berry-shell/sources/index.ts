import execa = require('execa');
// @ts-ignore
import streamBuffers = require('stream-buffers');

import {CommandSegment, CommandChain, CommandLine, ShellLine, parseShell} from '@berry/parsers';
import {Stream, PassThrough, Readable, Writable}                          from 'stream';
import {StringDecoder}                                                    from 'string_decoder';

export type ShellOptions = {
  args: Array<string>,
  builtins: {[key: string]: (args: Array<string>, opts: ShellOptions) => Promise<void>},
  cwd: string,
  env: {[key: string]: string | undefined},
  stdin: Readable,
  stdout: Writable,
  stderr: Writable,
  variables: {[key: string]: string},
};

const BUILTINS = {
  async command([ident, ... rest]: Array<string>, {cwd, env, stdin, stdout, stderr}: ShellOptions) {
    const stdio: Array<any> = [`pipe`, `pipe`, `pipe`];

    if (stdin === process.stdin)
      stdio[0] = stdin;
    if (stdout === process.stdout)
      stdio[1] = stdout;
    if (stderr === process.stderr)
      stdio[2] = stderr;

    const subprocess = execa(ident, rest, {
      cwd,
      stdio,
    });

    if (stdin !== process.stdin)
      stdin.pipe(subprocess.stdin);
    if (stdout !== process.stdout)
      subprocess.stdout.pipe(stdout);
    if (stderr !== process.stderr)
      subprocess.stderr.pipe(stderr);

    return new Promise((resolve, reject) => {
      process.on(`exit`, code => {
        if (code === 0) {
          resolve();
        } else {
          reject();
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

    await runShellAst(ast, opts);

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

        close();
      }
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
      ? (opts: ShellOptions) => builtins[ident](args.slice(1), opts)
      : (opts: ShellOptions) => builtins.command(args, opts);

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
  env = process.env,
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
  variables = {},
}: Partial<ShellOptions> = {}) {
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
