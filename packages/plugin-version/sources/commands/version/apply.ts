import {BaseCommand}            from '@yarnpkg/cli';
import {Command, Option, Usage} from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class VersionApplyCommand extends BaseCommand {
  static paths = [
    [`version`, `apply`],
  ];

  static usage: Usage = Command.Usage({
    category: `Release-related commands`,
    description: `apply all the deferred version bumps at once`,
    details: `
      This command will apply the deferred version changes and remove their definitions from the repository.

      Note that if \`--prerelease\` is set, the given prerelease identifier (by default \`rc.%n\`) will be used on all new versions and the version definitions will be kept as-is.

      By default only the current workspace will be bumped, but you can configure this behavior by using one of:

      - \`--recursive\` to also apply the version bump on its dependencies
      - \`--all\` to apply the version bump on all packages in the repository

      Note that this command will also update the \`workspace:\` references across all your local workspaces, thus ensuring that they keep referring to the same workspaces even after the version bump.
    `,
    examples: [[
      `Apply the version change to the local workspace`,
      `yarn version apply`,
    ], [
      `Apply the version change to all the workspaces in the local workspace`,
      `yarn version apply --all`,
    ]],
  });

  all = Option.Boolean(`--all`, false, {
    description: `Apply the deferred version changes on all workspaces`,
  });

  recursive = Option.Boolean(`-R,--recursive`, {
    description: `Release the transitive workspaces as well`,
  });

  dryRun = Option.Boolean(`--dry-run`, false, {
    description: `Print the versions without actually generating the package archive`,
  });

  prerelease = Option.String(`--prerelease`, {
    description: `Add a prerelease identifier to new versions`,
    tolerateBoolean: true,
  });

  exact = Option.Boolean(`--exact`, false, {
    description: `Use the exact version of each package, removes any range. Useful for nightly releases where the range might match another version.`,
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

    if (this.dryRun)
      args.push(`--dry-run`);

    if (this.prerelease === true)
      args.push(`--prerelease`);
    else if (typeof this.prerelease === `string`)
      args.push(`--prerelease=${this.prerelease}`);

    if (this.exact)
      args.push(`--exact`);

    if (this.json)
      args.push(`--json`);

    return await this.cli.run(args);
  }
}
