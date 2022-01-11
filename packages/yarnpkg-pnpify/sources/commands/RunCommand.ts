import {execUtils}       from '@yarnpkg/core';
import {npath}           from '@yarnpkg/fslib';
import {Command, Option} from 'clipanion';

import {dynamicRequire}  from '../dynamicRequire';

// eslint-disable-next-line arca/no-default-export
export default class RunCommand extends Command {
  static paths = [
    [`run`],
    Command.Default,
  ];

  static usage = Command.Usage({
    description: `run a command with a virtual node_modules folder`,
    details: `
      When a non-PnP-compliant project tries to access the \`node_modules\` directories (for example through \`readdir\` or \`readFile\`), PnPify intercepts those calls and converts them into calls to the PnP API. Then, based on the result, it simulates the existence of a virtual \`node_modules\` folder that the underlying tool will then consume - still unaware that the files are extracted from a virtual filesystem.

      The \`run\` keyword can be omitted if the executed command doesn't conflict with built-in commands.

      For more details on PnPify, please consult the dedicated page from our website: https://yarnpkg.com/advanced/pnpify.
    `,
    examples: [[
      `Run Angular using PnPify`,
      `$0 ng build`,
    ]],
  });

  cwd = Option.String(`--cwd`, process.cwd(), {
    description: `The directory to run the command in`,
  });

  commandName = Option.String();
  args = Option.Proxy();

  async execute() {
    let {NODE_OPTIONS} = process.env;
    NODE_OPTIONS = `${NODE_OPTIONS || ``} --require ${JSON.stringify(dynamicRequire.resolve(`@yarnpkg/pnpify`))}`.trim();

    const {code} = await execUtils.pipevp(this.commandName, this.args, {
      cwd: npath.toPortablePath(this.cwd),
      stderr: this.context.stderr,
      stdin: this.context.stdin,
      stdout: this.context.stdout,
      env: {...process.env, NODE_OPTIONS},
    });

    return code;
  }
}
