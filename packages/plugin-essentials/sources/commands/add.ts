import {WorkspaceRequiredError}                                                     from '@berry/cli';
import {Cache, CommandContext, Configuration, Descriptor, LightReport, MessageName} from '@berry/core';
import {Project, StreamReport, Workspace}                                           from '@berry/core';
import {structUtils}                                                                from '@berry/core';
import {PortablePath}                                                               from '@berry/fslib';
import {Command}                                                                    from 'clipanion';
import inquirer                                                                     from 'inquirer';

import * as suggestUtils                                                            from '../suggestUtils';
import {Hooks}                                                                      from '..';

// eslint-disable-next-line arca/no-default-export
export default class AddCommand extends Command<CommandContext> {
  @Command.Rest()
  packages: Array<string> = [];

  @Command.Boolean(`-E,--exact`)
  exact: boolean = false;

  @Command.Boolean(`-T,--tilde`)
  tilde: boolean = false;

  @Command.Boolean(`-D,--dev`)
  dev: boolean = false;

  @Command.Boolean(`-P,--peer`)
  peer: boolean = false;

  @Command.Boolean(`-i,--interactive`)
  interactive: boolean = false;

  @Command.Boolean(`--cached`)
  cached: boolean = false;

  static usage = Command.Usage({
    description: `add dependencies to the project`,
    details: `
      This command adds a package to the package.json for the nearest workspace.

      - The package will by default be added to the regular \`dependencies\` field, but this behavior can be overriden thanks to the \`-D,--dev\` flag (which will cause the dependency to be added to the \`devDependencies\` field instead) and the \`-P,--peer\` flag (which will do the same but for \`peerDependencies\`).

      - If the added package doesn't specify a range at all its \`latest\` tag will be resolved and the returned version will be used to generate a new semver range (using the \`^\` modifier by default, or the \`~\` modifier if \`-T,--tilde\` is specified, or no modifier at all if \`-E,--exact\` is specified). Two exceptions to this rule: the first one is that if the package is a workspace then its local version will be used, and the second one is that if you use \`-P,--peer\` the default range will be \`*\` and won't be resolved at all.

      - If the added package specifies a tag range (such as \`latest\` or \`rc\`), Yarn will resolve this tag to a semver version and use that in the resulting package.json entry (meaning that \`yarn add foo@latest\` will have exactly the same effect as \`yarn add foo\`).

      If the \`-i,--interactive\` option is used (or if the \`preferInteractive\` settings is toggled on) the command will first try to check whether other workspaces in the project use the specified package and, if so, will offer to reuse them.

      If the \`--cached\` option is used, Yarn will preferably reuse the highest version already used somewhere within the project, even if through a transitive dependency.

      For a compilation of all the supported protocols, please consult the dedicated page from our website: .
    `,
    examples: [[
      `Add a regular package to the current workspace`,
      `yarn add lodash`,
    ], [
      `Add a specific version for a package to the current workspace`,
      `yarn add lodash@1.2.3`,
    ]],
  });

  @Command.Path(`add`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(this.context.cwd);

    // @ts-ignore
    const prompt = inquirer.createPromptModule({
      input: this.context.stdin,
      output: this.context.stdout,
    });

    const target = this.peer
      ? suggestUtils.Target.PEER
      : this.dev
        ? suggestUtils.Target.DEVELOPMENT
        : suggestUtils.Target.REGULAR;

    const modifier = this.exact
      ? suggestUtils.Modifier.EXACT
      : this.tilde
        ? suggestUtils.Modifier.TILDE
        : suggestUtils.Modifier.CARET;

    const strategies = [
      ...this.interactive ? [
        suggestUtils.Strategy.REUSE,
      ] : [],
      suggestUtils.Strategy.PROJECT,
      ...this.cached ? [
        suggestUtils.Strategy.CACHE,
      ] : [],
      suggestUtils.Strategy.LATEST,
    ];

    const maxResults = this.interactive
      ? Infinity
      : 1;

    const allSuggestions = await Promise.all(this.packages.map(async pseudoDescriptor => {
      const request = pseudoDescriptor.match(/^\.{0,2}\//)
        ? await suggestUtils.extractDescriptorFromPath(pseudoDescriptor as PortablePath, {cache, cwd: this.context.cwd, workspace})
        : structUtils.parseDescriptor(pseudoDescriptor);

      const suggestions = await suggestUtils.getSuggestedDescriptors(request, {project, workspace, cache, target, modifier, strategies, maxResults});

      return [request, suggestions] as [Descriptor, Array<suggestUtils.Suggestion>];
    }));

    const checkReport = await LightReport.start({
      configuration,
      stdout: this.context.stdout,
      suggestInstall: false,
    }, async report => {
      for (const [request, suggestions] of allSuggestions) {
        const nonNullSuggestions = suggestions.filter(suggestion => {
          return suggestion.descriptor !== null;
        });

        if (nonNullSuggestions.length === 0) {
          if (!project.configuration.get(`enableNetwork`)) {
            report.reportError(MessageName.CANT_SUGGEST_RESOLUTIONS, `${structUtils.prettyDescriptor(configuration, request)} can't be resolved to a satisfying range (note: network resolution has been disabled)`);
          } else {
            report.reportError(MessageName.CANT_SUGGEST_RESOLUTIONS, `${structUtils.prettyDescriptor(configuration, request)} can't be resolved to a satisfying range`);
          }
        }
      }
    });

    if (checkReport.hasErrors())
      return checkReport.exitCode();

    let askedQuestions = false;

    const afterWorkspaceDependencyAdditionList: Array<[
      Workspace,
      suggestUtils.Target,
      Descriptor
    ]> = [];

    const afterWorkspaceDependencyReplacementList: Array<[
      Workspace,
      suggestUtils.Target,
      Descriptor,
      Descriptor
    ]> = [];

    for (const [/*request*/, suggestions] of allSuggestions) {
      let selected;

      const nonNullSuggestions = suggestions.filter(suggestion => {
        return suggestion.descriptor !== null;
      });

      if (nonNullSuggestions.length === 1) {
        selected = nonNullSuggestions[0].descriptor;
      } else {
        askedQuestions = true;
        ({answer: selected} = await prompt({
          type: `list`,
          name: `answer`,
          message: `Which range to you want to use?`,
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

      if (typeof current === `undefined` || current.descriptorHash !== selected.descriptorHash) {
        workspace.manifest[target].set(
          selected.identHash,
          selected,
        );

        if (typeof current === `undefined`) {
          afterWorkspaceDependencyAdditionList.push([
            workspace,
            target,
            selected,
          ]);
        } else {
          afterWorkspaceDependencyReplacementList.push([
            workspace,
            target,
            current,
            selected,
          ]);
        }
      }
    }

    await configuration.triggerMultipleHooks(
      (hooks: Hooks) => hooks.afterWorkspaceDependencyAddition,
      afterWorkspaceDependencyAdditionList,
    );

    await configuration.triggerMultipleHooks(
      (hooks: Hooks) => hooks.afterWorkspaceDependencyReplacement,
      afterWorkspaceDependencyReplacementList,
    );

    if (askedQuestions)
      this.context.stdout.write(`\n`);

    let installReport;

    if (this.context.quiet) {
      installReport = await LightReport.start({
        configuration,
        stdout: this.context.stdout,
      }, async report => {
        await project.install({cache, report});
      });
    } else {
      installReport = await StreamReport.start({
        configuration,
        stdout: this.context.stdout,
      }, async report => {
        await project.install({cache, report});
      });
    }

    return installReport.exitCode();
  }
}
