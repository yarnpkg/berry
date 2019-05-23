import {WorkspaceRequiredError}                      from '@berry/cli';
import {Configuration, PluginConfiguration, Project} from '@berry/core';
import {PortablePath}                                from '@berry/fslib';
import {UsageError}                                  from 'clipanion';
import semver                                        from 'semver';
import * as yup                                      from 'yup';

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
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`version [strategy] [-d,--deferred]`)
  .categorize(`Release-related commands`)
  .describe(`apply a new version to the current package`)

  .validate(
    yup.object().shape({
      strategy: yup.string().test({
        name: `strategy`,
        message: '${strategy} must be a semver range or one of ${strategies}',
        params: {strategies: Array.from(STRATEGIES).join(`, `)},
        test: (range: string) => {
          return semver.valid(range) !== null || STRATEGIES.has(range);
        },
      }),
    }),
  )

  .detail(`
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
  `)

  .example(
    `Immediatly bump the version to the next major`,
    `yarn version major`,
  )

  .example(
    `Prepare the version to be bumped to the next major`,
    `yarn version major --deferred`
  )

  .action(async ({cwd, strategy, deferred, ...env}: {cwd: PortablePath, strategy: string, deferred: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {workspace} = await Project.find(configuration, cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(cwd);

    if (workspace.manifest.version == null)
      throw new UsageError(`Can't bump the version if there wasn't a version to begin with - use 0.0.0 as initial version then run the command again.`);

    const currentVersion = workspace.manifest.version;
    if (typeof currentVersion !== `string` || !semver.valid(currentVersion))
      throw new UsageError(`Can't bump the version (${currentVersion}) if it's not valid semver`);

    const nextVersion = semver.inc(currentVersion, strategy as any);
    if (nextVersion === null)
      throw new Error(`Assertion failed: Failed to increment the version number (${currentVersion})`);

    const deferredVersion = workspace.manifest.raw[`version:next`];
    if (deferred && deferredVersion && semver.gte(deferredVersion, nextVersion))
      return;

    workspace.manifest.setRawField(`version:next`, nextVersion, {after: [`version`]});

    if (!deferred) {
      await clipanion.run(null, [`version`, `apply`], {cwd, ...env});
    }
  });
