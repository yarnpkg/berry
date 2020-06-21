import {BaseCommand, WorkspaceRequiredError}                                               from '@yarnpkg/cli';
import {Cache, Configuration, Descriptor, LightReport, MessageName, MinimalResolveOptions} from '@yarnpkg/core';
import {Project, StreamReport, Workspace}                                                  from '@yarnpkg/core';
import {structUtils}                                                                       from '@yarnpkg/core';
import {Command, Usage, UsageError}                                                        from 'clipanion';
import inquirer                                                                            from 'inquirer';
import micromatch                                                                          from 'micromatch';

import * as suggestUtils                                                                   from '../suggestUtils';
import {Hooks}                                                                             from '..';

// eslint-disable-next-line arca/no-default-export
export default class UpCommand extends BaseCommand {
  @Command.Rest()
  patterns: Array<string> = [];

  @Command.Boolean(`-i,--interactive`)
  interactive: boolean = false;

  @Command.Boolean(`-v,--verbose`)
  verbose: boolean = false;

  @Command.Boolean(`-E,--exact`)
  exact: boolean = false;

  @Command.Boolean(`-T,--tilde`)
  tilde: boolean = false;

  @Command.Boolean(`-C,--caret`)
  caret: boolean = false;

  static usage: Usage = Command.Usage({
    description: `upgrade dependencies across the project`,
    details: `
      This command upgrades the packages matching the list of specified patterns to their latest available version across the whole project (regardless of whether they're part of \`dependencies\` or \`devDependencies\` - \`peerDependencies\` won't be affected). This is a project-wide command: all workspaces will be upgraded in the process.

      If \`-i,--interactive\` is set (or if the \`preferInteractive\` settings is toggled on) the command will offer various choices, depending on the detected upgrade paths. Some upgrades require this flag in order to resolve ambiguities.

      The, \`-C,--caret\`, \`-E,--exact\` and  \`-T,--tilde\` options have the same meaning as in the \`add\` command (they change the modifier used when the range is missing or a tag, and are ignored when the range is explicitly set).

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

  @Command.Path(`up`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    // @ts-ignore
    const prompt = inquirer.createPromptModule({
      input: this.context.stdin as NodeJS.ReadStream,
      output: this.context.stdout as NodeJS.WriteStream,
    });

    const modifier = suggestUtils.getModifier(this, project);

    const strategies = this.interactive ? [
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
                await suggestUtils.getSuggestedDescriptors(request, {project, workspace, cache, target, modifier, strategies}),
              ] as [
                Workspace,
                suggestUtils.Target,
                Descriptor,
                Array<suggestUtils.Suggestion>
              ];
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
      throw new UsageError(`Patterns ${unreferencedPatterns.join(`, `)} don't match any packages referenced by any workspace`);
    if (unreferencedPatterns.length > 0)
      throw new UsageError(`Pattern ${unreferencedPatterns[0]} doesn't match any packages referenced by any workspace`);

    const allSuggestions = await Promise.all(allSuggestionsPromises);

    const checkReport = await LightReport.start({
      configuration,
      stdout: this.context.stdout,
      suggestInstall: false,
    }, async report => {
      for (const [/*workspace*/, /*target*/, existing, suggestions] of allSuggestions) {
        const nonNullSuggestions = suggestions.filter(suggestion => {
          return suggestion.descriptor !== null;
        });

        if (nonNullSuggestions.length === 0) {
          if (!project.configuration.get(`enableNetwork`)) {
            report.reportError(MessageName.CANT_SUGGEST_RESOLUTIONS, `${structUtils.prettyDescriptor(configuration, existing)} can't be resolved to a satisfying range (note: network resolution has been disabled)`);
          } else {
            report.reportError(MessageName.CANT_SUGGEST_RESOLUTIONS, `${structUtils.prettyDescriptor(configuration, existing)} can't be resolved to a satisfying range`);
          }
        } else if (nonNullSuggestions.length > 1 && !this.interactive) {
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
      Descriptor
    ]> = [];

    for (const [workspace, target, /*existing*/, suggestions] of allSuggestions) {
      let selected;

      const nonNullSuggestions = suggestions.filter(suggestion => {
        return suggestion.descriptor !== null;
      });

      const firstSuggestedDescriptor = nonNullSuggestions[0].descriptor;
      const areAllTheSame = nonNullSuggestions.every(suggestion => structUtils.areDescriptorsEqual(suggestion.descriptor, firstSuggestedDescriptor));

      if (nonNullSuggestions.length === 1 || areAllTheSame) {
        selected = firstSuggestedDescriptor;
      } else {
        askedQuestions = true;
        ({answer: selected} = await prompt({
          type: `list`,
          name: `answer`,
          message: `Which range to you want to use in ${structUtils.prettyWorkspace(configuration, workspace)} ❯ ${target}?`,
          choices: suggestions.map(({descriptor, reason}) => descriptor ? {
            name: reason,
            value: descriptor as Descriptor,
            short: structUtils.prettyDescriptor(project.configuration, descriptor),
          } : {
            name: reason,
            disabled: (): boolean => true,
          }),
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
      await project.install({cache, report});
    });

    return installReport.exitCode();
  }
}
