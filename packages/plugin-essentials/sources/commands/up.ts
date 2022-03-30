import {BaseCommand, WorkspaceRequiredError}                                                                        from '@yarnpkg/cli';
import {IdentHash, structUtils}                                                                                     from '@yarnpkg/core';
import {Project, StreamReport, Workspace, InstallMode}                                                              from '@yarnpkg/core';
import {Cache, Configuration, Descriptor, LightReport, MessageName, MinimalResolveOptions, formatUtils, FormatType} from '@yarnpkg/core';
import {Command, Option, Usage, UsageError}                                                                         from 'clipanion';
import {prompt}                                                                                                     from 'enquirer';
import micromatch                                                                                                   from 'micromatch';
import * as t                                                                                                       from 'typanion';

import * as suggestUtils                                                                                            from '../suggestUtils';
import {Hooks}                                                                                                      from '..';

// eslint-disable-next-line arca/no-default-export
export default class UpCommand extends BaseCommand {
  static paths = [
    [`up`],
  ];

  static usage: Usage = Command.Usage({
    description: `upgrade dependencies across the project`,
    details: `
      This command upgrades the packages matching the list of specified patterns to their latest available version across the whole project (regardless of whether they're part of \`dependencies\` or \`devDependencies\` - \`peerDependencies\` won't be affected). This is a project-wide command: all workspaces will be upgraded in the process.

      If \`-R,--recursive\` is set the command will change behavior and no other switch will be allowed. When operating under this mode \`yarn up\` will force all ranges matching the selected packages to be resolved again (often to the highest available versions) before being stored in the lockfile. It however won't touch your manifests anymore, so depending on your needs you might want to run both \`yarn up\` and \`yarn up -R\` to cover all bases.

      If \`-i,--interactive\` is set (or if the \`preferInteractive\` settings is toggled on) the command will offer various choices, depending on the detected upgrade paths. Some upgrades require this flag in order to resolve ambiguities.

      The, \`-C,--caret\`, \`-E,--exact\` and  \`-T,--tilde\` options have the same meaning as in the \`add\` command (they change the modifier used when the range is missing or a tag, and are ignored when the range is explicitly set).

      If the \`--mode=<mode>\` option is set, Yarn will change which artifacts are generated. The modes currently supported are:

      - \`skip-build\` will not run the build scripts at all. Note that this is different from setting \`enableScripts\` to false because the later will disable build scripts, and thus affect the content of the artifacts generated on disk, whereas the former will just disable the build step - but not the scripts themselves, which just won't run.

      - \`update-lockfile\` will skip the link step altogether, and only fetch packages that are missing from the lockfile (or that have no associated checksums). This mode is typically used by tools like Renovate or Dependabot to keep a lockfile up-to-date without incurring the full install cost.

      Generally you can see \`yarn up\` as a counterpart to what was \`yarn upgrade --latest\` in Yarn 1 (ie it ignores the ranges previously listed in your manifests), but unlike \`yarn upgrade\` which only upgraded dependencies in the current workspace, \`yarn up\` will upgrade all workspaces at the same time.

      This command accepts glob patterns as arguments (if valid Descriptors and supported by [micromatch](https://github.com/micromatch/micromatch)). Make sure to escape the patterns, to prevent your own shell from trying to expand them.

      **Note:** The ranges have to be static, only the package scopes and names can contain glob patterns.
    `,
    examples: [[
      `Upgrade all instances of lodash to the latest release`,
      `$0 up lodash`,
    ], [
      `Upgrade all instances of lodash to the latest release, but ask confirmation for each`,
      `$0 up lodash -i`,
    ], [
      `Upgrade all instances of lodash to 1.2.3`,
      `$0 up lodash@1.2.3`,
    ], [
      `Upgrade all instances of packages with the \`@babel\` scope to the latest release`,
      `$0 up '@babel/*'`,
    ], [
      `Upgrade all instances of packages containing the word \`jest\` to the latest release`,
      `$0 up '*jest*'`,
    ], [
      `Upgrade all instances of packages with the \`@babel\` scope to 7.0.0`,
      `$0 up '@babel/*@7.0.0'`,
    ]],
  });

  interactive = Option.Boolean(`-i,--interactive`, {
    description: `Offer various choices, depending on the detected upgrade paths`,
  });

  fixed = Option.Boolean(`-F,--fixed`, false, {
    description: `Store dependency tags as-is instead of resolving them`,
  });

  exact = Option.Boolean(`-E,--exact`, false, {
    description: `Don't use any semver modifier on the resolved range`,
  });

  tilde = Option.Boolean(`-T,--tilde`, false, {
    description: `Use the \`~\` semver modifier on the resolved range`,
  });

  caret = Option.Boolean(`-C,--caret`, false, {
    description: `Use the \`^\` semver modifier on the resolved range`,
  });

  recursive = Option.Boolean(`-R,--recursive`, false, {
    description: `Resolve again ALL resolutions for those packages`,
  });

  mode = Option.String(`--mode`, {
    description: `Change what artifacts installs generate`,
    validator: t.isEnum(InstallMode),
  });

  patterns = Option.Rest();

  static schema = [
    t.hasKeyRelationship(`recursive`, t.KeyRelationship.Forbids, [`interactive`, `exact`, `tilde`, `caret`], {ignore: [undefined, false]}),
  ];

  async execute() {
    if (this.recursive) {
      return await this.executeUpRecursive();
    } else {
      return await this.executeUpClassic();
    }
  }

  async executeUpRecursive() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.restoreInstallState({
      restoreResolutions: false,
    });

    const allDescriptors = [...project.storedDescriptors.values()];

    const stringifiedIdents = allDescriptors.map(descriptor => {
      return structUtils.stringifyIdent(descriptor);
    });

    const relevantIdents = new Set<IdentHash>();
    for (const pattern of this.patterns) {
      if (structUtils.parseDescriptor(pattern).range !== `unknown`)
        throw new UsageError(`Ranges aren't allowed when using --recursive`);

      for (const stringifiedIdent of micromatch(stringifiedIdents, pattern)) {
        const ident = structUtils.parseIdent(stringifiedIdent);
        relevantIdents.add(ident.identHash);
      }
    }

    const relevantDescriptors = allDescriptors.filter(descriptor => {
      return relevantIdents.has(descriptor.identHash);
    });

    for (const descriptor of relevantDescriptors) {
      project.storedDescriptors.delete(descriptor.descriptorHash);
      project.storedResolutions.delete(descriptor.descriptorHash);
    }

    const installReport = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      await project.install({cache, report});
    });

    return installReport.exitCode();
  }

  async executeUpClassic() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.restoreInstallState({
      restoreResolutions: false,
    });

    const fixed = this.fixed;
    const interactive = this.interactive ?? configuration.get(`preferInteractive`);

    const modifier = suggestUtils.getModifier(this, project);

    const strategies = interactive ? [
      suggestUtils.Strategy.KEEP,
      suggestUtils.Strategy.REUSE,
      suggestUtils.Strategy.PROJECT,
      suggestUtils.Strategy.LATEST,
    ] : [
      suggestUtils.Strategy.PROJECT,
      suggestUtils.Strategy.LATEST,
    ];

    const allSuggestionsPromises = [];
    const unreferencedPatterns = [];

    for (const pattern of this.patterns) {
      let isReferenced = false;

      // The range has to be static
      const pseudoDescriptor = structUtils.parseDescriptor(pattern);

      for (const workspace of project.workspaces) {
        for (const target of [suggestUtils.Target.REGULAR, suggestUtils.Target.DEVELOPMENT]) {
          const descriptors = workspace.manifest.getForScope(target);
          const stringifiedIdents = [...descriptors.values()].map(descriptor => {
            return structUtils.stringifyIdent(descriptor);
          });

          for (const stringifiedIdent of micromatch(stringifiedIdents, structUtils.stringifyIdent(pseudoDescriptor))) {
            const ident = structUtils.parseIdent(stringifiedIdent);

            const existingDescriptor = workspace.manifest[target].get(ident.identHash);
            if (typeof existingDescriptor === `undefined`)
              throw new Error(`Assertion failed: Expected the descriptor to be registered`);

            const request = structUtils.makeDescriptor(ident, pseudoDescriptor.range);

            allSuggestionsPromises.push(Promise.resolve().then(async () => {
              return [
                workspace,
                target,
                existingDescriptor,
                await suggestUtils.getSuggestedDescriptors(request, {project, workspace, cache, target, fixed, modifier, strategies}),
              ] as const;
            }));

            isReferenced = true;
          }
        }
      }

      if (!isReferenced) {
        unreferencedPatterns.push(pattern);
      }
    }

    if (unreferencedPatterns.length > 1)
      throw new UsageError(`Patterns ${formatUtils.prettyList(configuration, unreferencedPatterns, FormatType.CODE)} don't match any packages referenced by any workspace`);
    if (unreferencedPatterns.length > 0)
      throw new UsageError(`Pattern ${formatUtils.prettyList(configuration, unreferencedPatterns, FormatType.CODE)} doesn't match any packages referenced by any workspace`);

    const allSuggestions = await Promise.all(allSuggestionsPromises);

    const checkReport = await LightReport.start({
      configuration,
      stdout: this.context.stdout,
      suggestInstall: false,
    }, async report => {
      for (const [/*workspace*/, /*target*/, existing, {suggestions, rejections}] of allSuggestions) {
        const nonNullSuggestions = suggestions.filter(suggestion => {
          return suggestion.descriptor !== null;
        });

        if (nonNullSuggestions.length === 0) {
          const [firstError] = rejections;
          if (typeof firstError === `undefined`)
            throw new Error(`Assertion failed: Expected an error to have been set`);

          const prettyError = this.cli.error(firstError);

          if (!project.configuration.get(`enableNetwork`)) {
            report.reportError(MessageName.CANT_SUGGEST_RESOLUTIONS, `${structUtils.prettyDescriptor(configuration, existing)} can't be resolved to a satisfying range (note: network resolution has been disabled)\n\n${prettyError}`);
          } else {
            report.reportError(MessageName.CANT_SUGGEST_RESOLUTIONS, `${structUtils.prettyDescriptor(configuration, existing)} can't be resolved to a satisfying range\n\n${prettyError}`);
          }
        } else if (nonNullSuggestions.length > 1 && !interactive) {
          report.reportError(MessageName.CANT_SUGGEST_RESOLUTIONS, `${structUtils.prettyDescriptor(configuration, existing)} has multiple possible upgrade strategies; use -i to disambiguate manually`);
        }
      }
    });

    if (checkReport.hasErrors())
      return checkReport.exitCode();

    let askedQuestions = false;

    const afterWorkspaceDependencyReplacementList: Array<[
      Workspace,
      suggestUtils.Target,
      Descriptor,
      Descriptor,
    ]> = [];

    for (const [workspace, target, /*existing*/, {suggestions}] of allSuggestions) {
      let selected;

      const nonNullSuggestions = suggestions.filter(suggestion => {
        return suggestion.descriptor !== null;
      }) as Array<suggestUtils.Suggestion>;

      const firstSuggestedDescriptor = nonNullSuggestions[0].descriptor;
      const areAllTheSame = nonNullSuggestions.every(suggestion => structUtils.areDescriptorsEqual(suggestion.descriptor, firstSuggestedDescriptor));

      if (nonNullSuggestions.length === 1 || areAllTheSame) {
        selected = firstSuggestedDescriptor;
      } else {
        askedQuestions = true;
        ({answer: selected} = await prompt({
          type: `select`,
          name: `answer`,
          message: `Which range to you want to use in ${structUtils.prettyWorkspace(configuration, workspace)} ❯ ${target}?`,
          choices: suggestions.map(({descriptor, name, reason}) => descriptor ? {
            name,
            hint: reason,
            descriptor,
          } : {
            name,
            hint: reason,
            disabled: true,
          }),
          onCancel: () => process.exit(130),
          result(name: string) {
            // @ts-expect-error: The enquirer types don't include find
            return this.find(name, `descriptor`);
          },
          stdin: this.context.stdin as NodeJS.ReadStream,
          stdout: this.context.stdout as NodeJS.WriteStream,
        }));
      }

      const current = workspace.manifest[target].get(selected.identHash);

      if (typeof current === `undefined`)
        throw new Error(`Assertion failed: This descriptor should have a matching entry`);

      if (current.descriptorHash !== selected.descriptorHash) {
        workspace.manifest[target].set(
          selected.identHash,
          selected,
        );

        afterWorkspaceDependencyReplacementList.push([
          workspace,
          target,
          current,
          selected,
        ]);
      } else {
        const resolver = configuration.makeResolver();
        const resolveOptions: MinimalResolveOptions = {project, resolver};
        const bound = resolver.bindDescriptor(current, workspace.anchoredLocator, resolveOptions);

        project.forgetResolution(bound);
      }
    }

    await configuration.triggerMultipleHooks(
      (hooks: Hooks) => hooks.afterWorkspaceDependencyReplacement,
      afterWorkspaceDependencyReplacementList,
    );

    if (askedQuestions)
      this.context.stdout.write(`\n`);

    const installReport = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      await project.install({cache, report, mode: this.mode});
    });

    return installReport.exitCode();
  }
}
