import {Configuration, formatUtils} from '@yarnpkg/core';

import {BaseCommand}                from './BaseCommand';

const getMessage = (configuration: Configuration) => `
${formatUtils.pretty(configuration, `Welcome on Yarn 2!`, `bold`)} 🎉 Thanks for helping us shape our vision of how projects
should be managed going forward.

Being still in RC, Yarn 2 isn't completely stable yet. Some features might be
missing, and some behaviors may have received major overhaul. In case of doubt,
use the following URLs to get some insight:

  - The changelog:
    ${formatUtils.pretty(configuration, `https://github.com/yarnpkg/berry/tree/CHANGELOG.md`, `cyan`)}

  - Our issue tracker:
    ${formatUtils.pretty(configuration, `https://github.com/yarnpkg/berry`, `cyan`)}

  - Our Discord server:
    ${formatUtils.pretty(configuration, `https://discord.gg/yarnpkg`, `cyan`)}

We're hoping you will enjoy the experience. For now, a good start is to run
the two following commands:

  ${formatUtils.pretty(configuration, `find . -name node_modules -prune -exec rm -r {} \\;`, `magenta`)}
  ${formatUtils.pretty(configuration, `yarn install`, `magenta`)}

One last trick! If you need at some point to upgrade Yarn to a nightly build,
the following command will install the CLI straight from master:

  ${formatUtils.pretty(configuration, `yarn set version from sources`, `magenta`)}

See you later 👋
`;

export class WelcomeCommand extends BaseCommand {
  static paths = [
    [`--welcome`],
  ];

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    this.context.stdout.write(`${getMessage(configuration).trim()}\n`);
  }
}
