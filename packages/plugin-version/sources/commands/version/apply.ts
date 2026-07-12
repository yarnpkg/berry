import {BaseCommand}            from '@yarnpkg/cli';
import {Command, Option, Usage} from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class VersionApplyCommand extends BaseCommand {
  static paths = [
    [`version`, `apply`],
  ];

  static usage: Usage = Command.Usage({
    category: `Release-related commands`,
    description: `apply deferred records to workspaces`,
    details: `
      This command will apply the deferred version changes to workspaces. The applied records are removed from the project.

      For more information on the options, see the \`yarn version\` command. For more information on the deferred versioning workflow, see our documentation (https://yarnpkg.com/features/release-workflow#deferred-versioning).
    `,
    examples: [[
      `Apply deferred records of current workspace`,
      `yarn version apply`,
    ], [
      `Apply deferred records of all the workspaces in the local workspace`,
      `yarn version apply --all`,
    ]],
  });

  all = Option.Boolean(`--all`, false, {
    description: `Bump the version of all workspaces`,
  });

  recursive = Option.Boolean(`-R,--recursive`, {
    description: `Bump the version of dependent workspaces as well`,
  });

  exact = Option.Boolean(`--exact`, false, {
    description: `When updating parent workspaces' dependencies, use exact versions of bumped workspaces, removing any range.`,
  });

  prerelease = Option.String(`--prerelease`, {
    description: `Specify a prerelease pattern to use when working with prerelease versions`,
    tolerateBoolean: true,
  });

  dryRun = Option.Boolean(`--dry-run`, false, {
    description: `Print version(s)/record(s) without actually bumping versions or recording deferred releases`,
  });

  force = Option.Boolean(`--force`, false, {
    description: `Bypass check for bumping to a lower version than the current/deferred one`,
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  async execute() {
    const args = [`version`, `decline`, `--immediate`];

    if (this.all)
      args.push(`--all`);

    if (this.recursive)
      args.push(`--recursive`);

    if (this.exact)
      args.push(`--exact`);

    if (this.prerelease === true)
      args.push(`--prerelease`);
    else if (typeof this.prerelease === `string`)
      args.push(`--prerelease=${this.prerelease}`);

    if (this.dryRun)
      args.push(`--dry-run`);

    if (this.force)
      args.push(`--force`);

    if (this.json)
      args.push(`--json`);

    return await this.cli.run(args);
  }
}
