import {Configuration, formatUtils} from '@yarnpkg/core';
import {Command}                    from 'clipanion';

import {BaseCommand}                from './BaseCommand';

const getMessage = (configuration: Configuration) => `
${formatUtils.pretty(configuration, `Welcome to Yarn 2!`, `bold`)} 🎉 Thanks for helping us shape our vision of how projects
should be managed going forward.

Yarn 2 is continuously undergoing improvement. Some features are being
added, and some behaviors may receive major overhaul.

You can find out more about changes by visiting the following URLs:

  - The changelog:
    ${formatUtils.pretty(configuration, `https://github.com/yarnpkg/berry/tree/CHANGELOG.md`, `cyan`)}

  - Our issue tracker:
    ${formatUtils.pretty(configuration, `https://github.com/yarnpkg/berry`, `cyan`)}

  - Our Discord server:
    ${formatUtils.pretty(configuration, `https://discord.gg/yarnpkg`, `cyan`)}

We hope you will enjoy your experience with Yarn 2.

A good start is to run the two following commands:

  ${formatUtils.pretty(configuration, `find . -name node_modules -prune -exec rm -r {} \\;`, `magenta`)}
  ${formatUtils.pretty(configuration, `yarn install`, `magenta`)}

One last trick! If you desire to upgrade Yarn to the nightly build,
the following command will install the CLI straight from the master branch, this is where Yarn 3 is being developed:

  ${formatUtils.pretty(configuration, `yarn set version from sources`, `magenta`)}

See you later 👋
`;

export class WelcomeCommand extends BaseCommand {
  @Command.Path(`--welcome`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    this.context.stdout.write(`${getMessage(configuration).trim()}\n`);
  }
}
