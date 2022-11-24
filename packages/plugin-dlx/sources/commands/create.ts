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

    // @foo -> @foo/create
    const command = this.command.replace(/^(@[^@/]+)(@|$)/, `$1/create$2`);
    const descriptor = structUtils.parseDescriptor(command);

    // @foo/app -> @foo/create-app
    // foo -> create-foo
    const modifiedIdent = !descriptor.name.match(/^create(-|$)/)
      ? descriptor.scope
        ? structUtils.makeIdent(descriptor.scope, `create-${descriptor.name}`)
        : structUtils.makeIdent(null, `create-${descriptor.name}`)
      : descriptor;

    let finalDescriptorString = structUtils.stringifyIdent(modifiedIdent);
    if (descriptor.range !== `unknown`)
      finalDescriptorString += `@${descriptor.range}`;

    return this.cli.run([`dlx`, ...flags, finalDescriptorString, ...this.args]);
  }
}
