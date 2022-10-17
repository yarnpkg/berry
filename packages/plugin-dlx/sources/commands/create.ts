import {BaseCommand}        from '@yarnpkg/cli';
import {Ident, structUtils} from '@yarnpkg/core';
import {Option}             from 'clipanion';

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

    const descriptor = structUtils.parseDescriptor(this.command);

    let modifiedIdent: Ident;

    if (descriptor.scope)
      // @foo/app -> @foo/create-app
      modifiedIdent = structUtils.makeIdent(descriptor.scope, `create-${descriptor.name}`);
    else if (descriptor.name.startsWith(`@`))
      // @foo     -> @foo/create
      modifiedIdent = structUtils.makeIdent(descriptor.name.substring(1), `create`);
    else
      // foo      -> create-foo
      modifiedIdent = structUtils.makeIdent(null, `create-${descriptor.name}`);

    let finalDescriptorString = structUtils.stringifyIdent(modifiedIdent);
    if (descriptor.range !== `unknown`)
      finalDescriptorString += `@${descriptor.range}`;

    return this.cli.run([`dlx`, ...flags, finalDescriptorString, ...this.args]);
  }
}
