import {WorkspaceRequiredError}                                      from '@berry/cli';
import {CommandContext, Configuration, Project}                      from '@berry/core';
import {Command, UsageError}                                         from 'clipanion';
import semver                                                        from 'semver';
import * as yup                                                      from 'yup';

const STRATEGIES = new Set([
  `major`,
  `minor`,
  `patch`,
  `premajor`,
  `preminor`,
  `prepatch`,
  `prerelease`,
]);

// eslint-disable-next-line arca/no-default-export
export default class VersionCommand extends Command<CommandContext> {
  @Command.String({required: false})
  strategy?: false;

  @Command.Boolean(`-d,--deferred`)
  deferred: boolean = false;

  static schema = yup.object().shape({
    strategy: yup.string().test({
      name: `strategy`,
      message: '${path} must be a semver range or one of ${strategies}',
      params: {strategies: Array.from(STRATEGIES).join(`, `)},
      test: (range: string) => {
        return semver.valid(range) !== null || STRATEGIES.has(range);
      },
    }),
  });

  static usage = Command.Usage({
    category: `Release-related commands`,
    description: `apply a new version to the current package`,
    details: `
      This command will bump the version number for the given package, following the specified strategy:

      - If \`major\`, the first number from the semver range will be increased (\`X.0.0\`).
      - If \`minor\`, the second number from the semver range will be increased (\`0.X.0\`).
      - If \`patch\`, the third number from the semver range will be increased (\`0.0.X\`).
      - If prefixed by \`pre\` (\`premajor\`, ...), a \`-0\` suffix will be set (\`0.0.0-0\`).
      - If \`prerelease\`, the suffix will be increased (\`0.0.0-X\`); the third number from the semver range will also be increased if there was no suffix in the previous version.
      - If a valid semver range, it will be used as new version.
      - If unspecified, Yarn will ask you for guidance.

      Adding the \`--deferred\` flag will cause Yarn to "buffer" the version bump and only apply it during the next call to \`yarn version apply\`. This is recommended for monorepos that receive contributions from the open-source, as Yarn will remember multiple invocations to \`yarn version <strategy>\` and only apply the highest bump needed (so for example running \`yarn version major --deferred\` twice would only increase the first number of the semver range by a single increment).

      Note that the deferred value is lost when you call \`yarn version\` without the \`--deferred\` flag.
    `,
    examples: [[
      `Immediatly bump the version to the next major`,
      `yarn version major`,
    ], [
      `Prepare the version to be bumped to the next major`,
      `yarn version major --deferred`,
    ]],
  });

  @Command.Path(`version`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {workspace} = await Project.find(configuration, this.context.cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(this.context.cwd);

    if (workspace.manifest.version == null)
      throw new UsageError(`Can't bump the version if there wasn't a version to begin with - use 0.0.0 as initial version then run the command again.`);

    const currentVersion = workspace.manifest.version;
    if (typeof currentVersion !== `string` || !semver.valid(currentVersion))
      throw new UsageError(`Can't bump the version (${currentVersion}) if it's not valid semver`);

    const nextVersion = semver.inc(currentVersion, this.strategy as any);
    if (nextVersion === null)
      throw new Error(`Assertion failed: Failed to increment the version number (${currentVersion})`);

    const deferredVersion = workspace.manifest.raw[`version:next`];
    if (this.deferred && deferredVersion && semver.gte(deferredVersion, nextVersion))
      return;

    workspace.manifest.setRawField(`version:next`, nextVersion, {after: [`version`]});
    workspace.persistManifest();

    if (!this.deferred) {
      await this.cli.run([`version`, `apply`]);
    }
  }
}
