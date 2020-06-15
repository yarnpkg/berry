import {BaseCommand}    from '@yarnpkg/cli';
import {Command, Usage} from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class NodeCommand extends BaseCommand {
  @Command.Proxy()
  args: Array<string> = [];

  static usage: Usage = Command.Usage({
    description: `run node with the hook already setup`,
    details: `
      This command simply runs Node. It also makes sure to call it in a way that's compatible with the current project (for example, on PnP projects the environment will be setup in such a way that PnP will be correctly injected into the environment).

      The Node process will use the exact same version of Node as the one used to run Yarn itself, which might be a good way to ensure that your commands always use a consistent Node version.
    `,
    examples: [[
      `Run a Node script`,
      `$0 node ./my-script.js`,
    ]],
  });

  @Command.Path(`node`)
  async execute() {
    return this.cli.run([`exec`, `node`, ...this.args]);
  }
}
