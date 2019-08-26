import {BaseCommand}            from '@yarnpkg/cli';
import {Configuration, Project} from '@yarnpkg/core';
import {execUtils, scriptUtils} from '@yarnpkg/core';
import {Command}                from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class NodeCommand extends BaseCommand {
  @Command.Proxy()
  args: Array<string> = [];

  static usage = Command.Usage({
    description: `run node with the hook already setup`,
    details: `
      This command simply runs Node. It also makes sure to call it in a way that's compatible with the current project (for example, on PnP projects the environment will be setup in such a way that PnP will be correctly injected into the environment).

      The Node process will use the exact same version of Node as the one used to run Yarn itself, which might be a good way to ensure that your commands always use a consistent Node version.
    `,
    examples: [[
      `Run a Node script`,
      `yarn node ./my-script.js`,
    ]],
  });

  @Command.Path(`node`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);

    const {code} = await execUtils.pipevp(`node`, this.args, {
      cwd: this.context.cwd,
      stdin: this.context.stdin,
      stdout: this.context.stdout,
      stderr: this.context.stderr,
      env: await scriptUtils.makeScriptEnv(project),
    });

    return code;
  }
}
