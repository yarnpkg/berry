import {execUtils}         from '@yarnpkg/core';
import {NativePath, npath} from '@yarnpkg/fslib';
import {Command}           from 'clipanion';

import {dynamicRequire}    from '../dynamicRequire';

// eslint-disable-next-line arca/no-default-export
export default class RunCommand extends Command {
  @Command.String()
  commandName!: string;

  @Command.Proxy()
  args: Array<string> = [];

  @Command.String(`--cwd`)
  cwd: NativePath = process.cwd();

  async execute() {
    let {NODE_OPTIONS} = process.env;
    NODE_OPTIONS = `${NODE_OPTIONS || ``} --require ${dynamicRequire.resolve(`@yarnpkg/pnpify`)}`.trim();

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
