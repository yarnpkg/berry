import {BaseCommand} from '@yarnpkg/cli';
import {structUtils} from '@yarnpkg/core';
import {Option}      from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class CreateCommand extends BaseCommand {
  static paths = [
    [`create`],
  ];

  pkg = Option.String(`-p,--package`, {
    description: `The package to run the provided command from`,
  });

  quiet = Option.Boolean(`-q,--quiet`, false, {
    description: `Only report critical errors instead of printing the full install logs`,
  });

  command = Option.String();
  args = Option.Proxy();

  async execute() {
    const flags = [];
    if (this.pkg)
      flags.push(`--package`, this.pkg);
    if (this.quiet)
      flags.push(`--quiet`);

    const ident = structUtils.parseIdent(this.command);
    const modified = structUtils.makeIdent(ident.scope, `create-${ident.name}`);

    return this.cli.run([`dlx`, ...flags, structUtils.stringifyIdent(modified), ...this.args]);
  }
}
