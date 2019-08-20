import {WorkspaceRequiredError}                 from '@berry/cli';
import {CommandContext, Configuration, Project} from '@berry/core';
import {Command, UsageError}                    from 'clipanion';
import semver                                   from 'semver';
import * as yup                                 from 'yup';

// This is a special strategy; Yarn won't change the semver version,
// but will change the nonce. This will cause `yarn version check` to
// stop reporting the package as having no explicit bump strategy.
const DECLINE = `decline`;

const STRATEGIES = new Set([
  `major`,
  `minor`,
  `patch`,
  `premajor`,
  `preminor`,
  `prepatch`,
  `prerelease`,
  DECLINE,
]);

// eslint-disable-next-line arca/no-default-export
export default class VersionCommand extends Command<CommandContext> {
  @Command.String()
  strategy!: string;

  @Command.Boolean(`-d,--deferred`)
  deferred?: boolean;

  @Command.Boolean(`-i,--immediate`)
  immediate?: boolean;

  @Command.Boolean(`-f,--force`)
  force: boolean = false;

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
      - If \`decline\`, the nonce will be increased for \`yarn version check\` to pass without version bump.
      - If a valid semver range, it will be used as new version.
      - If unspecified, Yarn will ask you for guidance.

      For more information about the \`--deferred\` flag, consult our documentation ("Managing Releases").
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

    let deferred = configuration.get(`preferDeferredVersions`);
    if (this.deferred)
      deferred = true;
    if (this.immediate)
      deferred = false;

    const isSemver = semver.valid(this.strategy);

    let nextVersion;
    if (semver.valid(this.strategy)) {
      nextVersion = this.strategy;
    } else {
      if (workspace.manifest.version == null && !isSemver)
        throw new UsageError(`Can't bump the version if there wasn't a version to begin with - use 0.0.0 as initial version then run the command again.`);

      const currentVersion = workspace.manifest.version;
      if (typeof currentVersion !== `string` || !semver.valid(currentVersion))
        throw new UsageError(`Can't bump the version (${currentVersion}) if it's not valid semver`);

      const bumpedVersion = this.strategy !== `decline`
        ? semver.inc(currentVersion, this.strategy as any)
        : currentVersion;

      if (bumpedVersion === null)
        throw new Error(`Assertion failed: Failed to increment the version number (${currentVersion})`);

      nextVersion = bumpedVersion;
    }

    if (workspace.manifest.raw.nextVersion) {
      const deferredVersion = workspace.manifest.raw.nextVersion.next;
      if (deferred && deferredVersion && semver.gte(deferredVersion, nextVersion)) {
        if (isSemver) {
          if (!this.force) {
            throw new UsageError(`The target version (${nextVersion}) is smaller than the one currently registered (${deferredVersion}); use -f,--force to overwrite.`);
          }
        } else {
          if (this.strategy === DECLINE) {
            nextVersion = deferredVersion;
          } else {
            return;
          }
        }
      }
    }

    workspace.manifest.setRawField(`nextVersion`, {
      semver: nextVersion,
      nonce: String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
    }, {after: [`version`]});

    workspace.persistManifest();

    if (!this.deferred) {
      await this.cli.run([`version`, `apply`]);
    }
  }
}
