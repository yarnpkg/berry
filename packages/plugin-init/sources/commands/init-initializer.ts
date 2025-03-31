import {Option}    from 'clipanion';

import InitCommand from './init';

// eslint-disable-next-line arca/no-default-export
export default class InitInitializerCommand extends InitCommand {
  static paths = [
    [`init`],
  ];

  initializer = Option.String();
  argv = Option.Proxy();

  async initialize() {
    this.context.stdout.write(`\n`);

    await this.cli.run([`dlx`, this.initializer, ...this.argv], {
      quiet: true,
    });
  }
}
