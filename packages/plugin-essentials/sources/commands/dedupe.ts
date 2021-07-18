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

import {BaseCommand}                                              from '@yarnpkg/cli';
import {Configuration, Project, Cache, StreamReport, InstallMode} from '@yarnpkg/core';
import {Command, Option}                                          from 'clipanion';
import * as t                                                     from 'typanion';

import * as dedupeUtils                                           from '../dedupeUtils';

// eslint-disable-next-line arca/no-default-export
export default class DedupeCommand extends BaseCommand {
  static paths = [
    [`dedupe`],
  ];

  static usage = Command.Usage({
    description: `deduplicate dependencies with overlapping ranges`,
    details: `
      Duplicates are defined as descriptors with overlapping ranges being resolved and locked to different locators. They are a natural consequence of Yarn's deterministic installs, but they can sometimes pile up and unnecessarily increase the size of your project.

      This command dedupes dependencies in the current project using different strategies (only one is implemented at the moment):

      - \`highest\`: Reuses (where possible) the locators with the highest versions. This means that dependencies can only be upgraded, never downgraded. It's also guaranteed that it never takes more than a single pass to dedupe the entire dependency tree.

      **Note:** Even though it never produces a wrong dependency tree, this command should be used with caution, as it modifies the dependency tree, which can sometimes cause problems when packages don't strictly follow semver recommendations. Because of this, it is recommended to also review the changes manually.

      If set, the \`-c,--check\` flag will only report the found duplicates, without persisting the modified dependency tree. If changes are found, the command will exit with a non-zero exit code, making it suitable for CI purposes.

      If the \`--mode=<mode>\` option is set, Yarn will change which artifacts are generated. The modes currently supported are:

      - \`skip-build\` will not run the build scripts at all. Note that this is different from setting \`enableScripts\` to false because the later will disable build scripts, and thus affect the content of the artifacts generated on disk, whereas the former will just disable the build step - but not the scripts themselves, which just won't run.

      - \`update-lockfile\` will skip the link step altogether, and only fetch packages that are missing from the lockfile (or that have no associated checksums). This mode is typically used by tools like Renovate or Dependabot to keep a lockfile up-to-date without incurring the full install cost.

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

  strategy = Option.String(`-s,--strategy`, dedupeUtils.Strategy.HIGHEST, {
    description: `The strategy to use when deduping dependencies`,
    validator: t.isEnum(dedupeUtils.Strategy),
  });

  check = Option.Boolean(`-c,--check`, false, {
    description: `Exit with exit code 1 when duplicates are found, without persisting the dependency tree`,
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  mode = Option.String(`--mode`, {
    description: `Change what artifacts installs generate`,
    validator: t.isEnum(InstallMode),
  });

  patterns = Option.Rest();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    await project.restoreInstallState({
      restoreResolutions: false,
    });

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
        await project.install({cache, report, mode: this.mode});
      });

      return installReport.exitCode();
    }
  }
}
