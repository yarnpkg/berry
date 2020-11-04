/**
 * Prior work:
 * - https://github.com/atlassian/yarn-deduplicate
 * - https://github.com/eps1lon/yarn-plugin-deduplicate
 *
 * Goals of the `dedupe` command:
 * - the deduplication algorithms shouldn't depend on semver; they should instead use the resolver `getSatisfying` system
 * - the deduplication should happen concurrently
 *
 * Note: We don't restore the install state because we already have everything we need inside the
 * lockfile. Because of this, we use `project.originalPackages` instead of `project.storedPackages`
 * (which also provides a safe-guard in case virtual descriptors ever make their way into the dedupe algorithm).
 */

import {BaseCommand}                                 from '@yarnpkg/cli';
import {Configuration, Project, Cache, StreamReport} from '@yarnpkg/core';
import {Command}                                     from 'clipanion';
import * as yup                                      from 'yup';

import * as dedupeUtils                              from '../dedupeUtils';

// eslint-disable-next-line arca/no-default-export
export default class DedupeCommand extends BaseCommand {
  @Command.Rest()
  patterns: Array<string> = [];

  @Command.String(`-s,--strategy`, {description: `The strategy to use when deduping dependencies`})
  strategy: dedupeUtils.Strategy = dedupeUtils.Strategy.HIGHEST;

  @Command.Boolean(`-c,--check`, {description: `Exit with exit code 1 when duplicates are found, without persisting the dependency tree`})
  check: boolean = false;

  @Command.Boolean(`--json`, {description: `Format the output as an NDJSON stream`})
  json: boolean = false;

  static schema = yup.object().shape({
    strategy: yup.string().test({
      name: `strategy`,
      message: `\${path} must be one of \${strategies}`,
      params: {strategies: [...dedupeUtils.acceptedStrategies].join(`, `)},
      test: (strategy: string) => {
        return dedupeUtils.acceptedStrategies.has(strategy as dedupeUtils.Strategy);
      },
    }),
  });

  static usage = Command.Usage({
    description: `deduplicate dependencies with overlapping ranges`,
    details: `
      Duplicates are defined as descriptors with overlapping ranges being resolved and locked to different locators. They are a natural consequence of Yarn's deterministic installs, but they can sometimes pile up and unnecessarily increase the size of your project.

      This command dedupes dependencies in the current project using different strategies (only one is implemented at the moment):

      - \`highest\`: Reuses (where possible) the locators with the highest versions. This means that dependencies can only be upgraded, never downgraded. It's also guaranteed that it never takes more than a single pass to dedupe the entire dependency tree.

      **Note:** Even though it never produces a wrong dependency tree, this command should be used with caution, as it modifies the dependency tree, which can sometimes cause problems when packages don't strictly follow semver recommendations. Because of this, it is recommended to also review the changes manually.

      If set, the \`-c,--check\` flag will only report the found duplicates, without persisting the modified dependency tree. If changes are found, the command will exit with a non-zero exit code, making it suitable for CI purposes.

      This command accepts glob patterns as arguments (if valid Idents and supported by [micromatch](https://github.com/micromatch/micromatch)). Make sure to escape the patterns, to prevent your own shell from trying to expand them.

      ### In-depth explanation:

      Yarn doesn't deduplicate dependencies by default, otherwise installs wouldn't be deterministic and the lockfile would be useless. What it actually does is that it tries to not duplicate dependencies in the first place.

      **Example:** If \`foo@^2.3.4\` (a dependency of a dependency) has already been resolved to \`foo@2.3.4\`, running \`yarn add foo@*\`will cause Yarn to reuse \`foo@2.3.4\`, even if the latest \`foo\` is actually \`foo@2.10.14\`, thus preventing unnecessary duplication.

      Duplication happens when Yarn can't unlock dependencies that have already been locked inside the lockfile.

      **Example:** If \`foo@^2.3.4\` (a dependency of a dependency) has already been resolved to \`foo@2.3.4\`, running \`yarn add foo@2.10.14\` will cause Yarn to install \`foo@2.10.14\` because the existing resolution doesn't satisfy the range \`2.10.14\`. This behavior can lead to (sometimes) unwanted duplication, since now the lockfile contains 2 separate resolutions for the 2 \`foo\` descriptors, even though they have overlapping ranges, which means that the lockfile can be simplified so that both descriptors resolve to \`foo@2.10.14\`.
    `,
    examples: [[
      `Dedupe all packages`,
      `$0 dedupe`,
    ], [
      `Dedupe all packages using a specific strategy`,
      `$0 dedupe --strategy highest`,
    ], [
      `Dedupe a specific package`,
      `$0 dedupe lodash`,
    ], [
      `Dedupe all packages with the \`@babel/*\` scope`,
      `$0 dedupe '@babel/*'`,
    ], [
      `Check for duplicates (can be used as a CI step)`,
      `$0 dedupe --check`,
    ]],
  });

  @Command.Path(`dedupe`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    let dedupedPackageCount: number = 0;
    const dedupeReport = await StreamReport.start({
      configuration,
      includeFooter: false,
      stdout: this.context.stdout,
      json: this.json,
    }, async report => {
      dedupedPackageCount = await dedupeUtils.dedupe(project, {strategy: this.strategy, patterns: this.patterns, cache, report});
    });

    if (dedupeReport.hasErrors())
      return dedupeReport.exitCode();

    if (this.check) {
      return dedupedPackageCount ? 1 : 0;
    } else {
      const installReport = await StreamReport.start({
        configuration,
        stdout: this.context.stdout,
        json: this.json,
      }, async report => {
        await project.install({cache, report});
      });

      return installReport.exitCode();
    }
  }
}
