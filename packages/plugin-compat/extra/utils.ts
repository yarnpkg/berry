import chalk               from 'chalk';
import crossSpawn          from 'cross-spawn';
import type {SpawnOptions} from 'node:child_process';
import {once}              from 'node:events';

export function formatArg(arg: string) {
  if (arg.includes(` `)) {
    if (!arg.includes(`'`)) {
      return `'${arg}'`;
    } else if (!arg.includes(`"`) && !arg.includes(`$`) && !arg.includes(`\``) && !arg.includes(`\\`)) {
      return `"${arg}"`;
    } else {
      return `'${arg.replace(/'/g, `'"'"'`)}'`;
    }
  }

  return arg;
}
export function spawn(binary: string, args: Array<string>, opts: SpawnOptions = {}) {
  const child = crossSpawn(binary, args, {
    ...opts,
    env: {
      ...process.env,
      NODE_OPTIONS: undefined,
      ...opts.env,
    },
  });

  const outChunks: Array<Buffer> = [];
  const allChunks: Array<Buffer> = [];
  child.stdout?.on(`data`, chunk => {
    outChunks.push(chunk);
    allChunks.push(chunk);
  });
  child.stderr?.on(`data`, chunk => {
    allChunks.push(chunk);
  });

  const close = once(child, `close`).catch(err => {
    err.message += `\n\n${Buffer.concat(allChunks).toString()}\n`;
    throw err;
  });
  close.catch(() => { }); // Prevent unhandled rejection - the caller should handle i

  return {
    process: child,
    cmd: `${binary} ${args.map(formatArg).join(` `)}`,

    close,
    get exit() {
      return close.then(([code]) => code);
    },
    get success() {
      return close.then(([code]) => {
        if (code !== 0) {
          throw new Error([
            `Process failed`,
            ` Command: ${binary} ${args.join(` `)}`,
            ` Exit code: ${code}`,
            ` Output:\n${Buffer.concat(allChunks).toString()}`,
          ].join(`\n`));
        }
      });
    },

    get output() {
      return close.then(() => Buffer.concat(outChunks));
    },
  };
}

export const logger = {
  indent: 0,
  log(message: string) {
    console.log(`${` `.repeat(this.indent)}${chalk.grey(message)}`);
  },
  info(message: string) {
    console.log(`${` `.repeat(this.indent)}${message}`);
  },
  warn(message: string) {
    console.log(`${` `.repeat(this.indent)}${chalk.yellow(message)}`);
  },
  async section<T>(title: string, cb: () => Promise<T>): Promise<T> {
    this.info(`- ${title}`);
    this.indent += 2;
    try {
      return await cb();
    } finally {
      this.indent -= 2;
    }
  },
};
