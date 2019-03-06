import {WorkspaceRequiredError}                                     from '@berry/cli';
import {Cache, Configuration, Descriptor, LightReport, MessageName} from '@berry/core';
import {PluginConfiguration, Project, StreamReport, Workspace}      from '@berry/core';
import {structUtils}                                                from '@berry/core';
import inquirer                                                     from 'inquirer';
import {Readable, Writable}                                         from 'stream';

import * as suggestUtils                                            from '../suggestUtils';
import {Hooks}                                                      from '..';

export default (concierge: any, pluginConfiguration: PluginConfiguration) => concierge

  .command(`add [... packages] [-E,--exact] [-T,--tilde] [-D,--dev] [-P,--peer] [-i,--interactive]`)
  .describe(`add dependencies to the project`)

  .detail(`
    This command adds a package to the package.json for the nearest workspace.

    - The package will by default be added to the regular \`dependencies\` field, but this behavior can be overriden thanks to the \`-D,--dev\` flag (which will cause the dependency to be added to the \`devDependencies\` field instead) and the \`-P,--peer\` flag (which will do the same but for \`peerDependencies\`).

    - If the added package doesn't specify a range at all its \`latest\` tag will be resolved and the returned version will be used to generate a new semver range (using the \`^\` modifier by default, or the \`~\` modifier if \`-T,--tilde\` is specified, or no modifier at all if \`-E,--exact\` is specified). Two exceptions to this rule: the first one is that if the package is a workspace then its local version will be used, and the second one is that if you use \`-P,--peer\` the default range will be \`*\` and won't be resolved at all.
    
    - If the added package specifies a tag range (such as \`latest\` or \`rc\`), Yarn will resolve this tag to a semver version and use that in the resulting package.json entry (meaning that \`yarn add foo@latest\` will have exactly the same effect as \`yarn add foo\`).

    If the \`-i,--interactive\` option is used (or if the \`preferInteractive\` settings is toggled on) the command will first try to check whether other workspaces in the project use the specified package and, if so, will offer to reuse them.
    
    For a compilation of all the supported protocols, please consult the dedicated page from our website: .
  `)

  .example(
    `Adds a regular package to the current workspace`,
    `yarn add lodash`,
  )

  .example(
    `Adds a specific version for a package to the current workspace`,
    `yarn add lodash@1.2.3`,
  )

  .action(async ({cwd, stdin, stdout, packages, exact, tilde, dev, peer, interactive}: {cwd: string, stdin: Readable, stdout: Writable, packages: Array<string>, exact: boolean, tilde: boolean, dev: boolean, peer: boolean, interactive: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(cwd);

    // @ts-ignore
    const prompt = inquirer.createPromptModule({
      input: stdin,
      output: stdout,
    });

    const target = peer
      ? suggestUtils.Target.PEER
      : dev
        ? suggestUtils.Target.DEVELOPMENT
        : suggestUtils.Target.REGULAR;

    const modifier = exact
      ? suggestUtils.Modifier.EXACT
      : tilde
        ? suggestUtils.Modifier.TILDE
        : suggestUtils.Modifier.CARET;

    const strategies = interactive ? [
      suggestUtils.Strategy.REUSE,
      suggestUtils.Strategy.PROJECT,
      suggestUtils.Strategy.LATEST,
    ] : [
      suggestUtils.Strategy.PROJECT,
      suggestUtils.Strategy.LATEST,
    ];

    const maxResults = interactive
      ? Infinity
      : 1;

    const allSuggestions = await Promise.all(packages.map(async pseudoDescriptor => {
      const request = structUtils.parseDescriptor(pseudoDescriptor);
      const suggestions = await suggestUtils.getSuggestedDescriptors(request, null, {project, cache, target, modifier, strategies, maxResults});

      return [request, suggestions] as [Descriptor, Array<suggestUtils.Suggestion>];
    }));

    const checkReport = await LightReport.start({configuration, stdout, suggestInstall: false}, async report => {
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
    let hasChanged = false;

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

    for (const [request, suggestions] of allSuggestions) {
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

        hasChanged = true;
      }
    }

    if (hasChanged) {
      await configuration.triggerMultipleHooks(
        (hooks: Hooks) => hooks.afterWorkspaceDependencyAddition,
        afterWorkspaceDependencyAdditionList,
      );

      await configuration.triggerMultipleHooks(
        (hooks: Hooks) => hooks.afterWorkspaceDependencyReplacement,
        afterWorkspaceDependencyReplacementList,
      );

      if (askedQuestions)
        stdout.write(`\n`);

      const installReport = await StreamReport.start({configuration, stdout}, async report => {
        await project.install({cache, report});
      });

      return installReport.exitCode();
    }
  });
