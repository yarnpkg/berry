import {BaseCommand, WorkspaceRequiredError}                        from '@yarnpkg/cli';
import {Cache, Configuration, Descriptor, LightReport, MessageName} from '@yarnpkg/core';
import {Project, StreamReport, Workspace, Ident}                    from '@yarnpkg/core';
import {structUtils}                                                from '@yarnpkg/core';
import {PortablePath}                                               from '@yarnpkg/fslib';
import {Command, Usage, UsageError}                                 from 'clipanion';
import inquirer                                                     from 'inquirer';

import * as suggestUtils                                            from '../suggestUtils';
import {Hooks}                                                      from '..';

// eslint-disable-next-line arca/no-default-export
export default class AddCommand extends BaseCommand {
  @Command.Rest()
  packages: Array<string> = [];

  @Command.Boolean(`--json`)
  json: boolean = false;

  @Command.Boolean(`-E,--exact`)
  exact: boolean = false;

  @Command.Boolean(`-T,--tilde`)
  tilde: boolean = false;

  @Command.Boolean(`-C,--caret`)
  caret: boolean = false;

  @Command.Boolean(`-D,--dev`)
  dev: boolean = false;

  @Command.Boolean(`-P,--peer`)
  peer: boolean = false;

  @Command.Boolean(`-O,--optional`)
  optional: boolean = false;

  @Command.Boolean(`--prefer-dev`)
  preferDev: boolean = false;

  @Command.Boolean(`-i,--interactive`)
  interactive: boolean = false;

  @Command.Boolean(`--cached`)
  cached: boolean = false;

  static usage: Usage = Command.Usage({
    description: `add dependencies to the project`,
    details: `
      This command adds a package to the package.json for the nearest workspace.

      - If it didn't exist before, the package will by default be added to the regular \`dependencies\` field, but this behavior can be overriden thanks to the \`-D,--dev\` flag (which will cause the dependency to be added to the \`devDependencies\` field instead) and the \`-P,--peer\` flag (which will do the same but for \`peerDependencies\`).

      - If the package was already listed in your dependencies, it will by default be upgraded whether it's part of your \`dependencies\` or \`devDependencies\` (it won't ever update \`peerDependencies\`, though).

      - If set, the \`--prefer-dev\` flag will operate as a more flexible \`-D,--dev\` in that it will add the package to your \`devDependencies\` if it isn't already listed in either \`dependencies\` or \`devDependencies\`, but it will also happily upgrade your \`dependencies\` if that's what you already use (whereas \`-D,--dev\` would throw an exception).

      - If set, the \`-O,--optional\` flag will add the package to the \`optionalDependencies\` field and, in combination with the \`-P,--peer\` flag, it will add the package as an optional peer dependency. If the package was already listed in your \`dependencies\`, it will be upgraded to \`optionalDependencies\`. If the package was already listed in your \`peerDependencies\`, in combination with the \`-P,--peer\` flag, it will be upgraded to an optional peer dependency: \`"peerDependenciesMeta": { "<package>": { "optional": true } }\`

      - If the added package doesn't specify a range at all its \`latest\` tag will be resolved and the returned version will be used to generate a new semver range (using the \`^\` modifier by default unless otherwise configured via the \`savePrefix\` configuration, or the \`~\` modifier if \`-T,--tilde\` is specified, or no modifier at all if \`-E,--exact\` is specified). Two exceptions to this rule: the first one is that if the package is a workspace then its local version will be used, and the second one is that if you use \`-P,--peer\` the default range will be \`*\` and won't be resolved at all.

      - If the added package specifies a tag range (such as \`latest\` or \`rc\`), Yarn will resolve this tag to a semver version and use that in the resulting package.json entry (meaning that \`yarn add foo@latest\` will have exactly the same effect as \`yarn add foo\`).

      If the \`--cached\` option is used, Yarn will preferably reuse the highest version already used somewhere within the project, even if through a transitive dependency.

      If the \`-i,--interactive\` option is used (or if the \`preferInteractive\` settings is toggled on) the command will first try to check whether other workspaces in the project use the specified package and, if so, will offer to reuse them.

      If the \`--json\` flag is set the output will follow a JSON-stream output also known as NDJSON (https://github.com/ndjson/ndjson-spec).

      For a compilation of all the supported protocols, please consult the dedicated page from our website: .
    `,
    examples: [[
      `Add a regular package to the current workspace`,
      `$0 add lodash`,
    ], [
      `Add a specific version for a package to the current workspace`,
      `$0 add lodash@1.2.3`,
    ], [
      `Add a package from a GitHub repository (the master branch) to the current workspace using a URL`,
      `$0 add lodash@https://github.com/lodash/lodash`,
    ], [
      `Add a package from a GitHub repository (the master branch) to the current workspace using the GitHub protocol`,
      `$0 add lodash@github:lodash/lodash`,
    ], [
      `Add a package from a GitHub repository (the master branch) to the current workspace using the GitHub protocol (shorthand)`,
      `$0 add lodash@lodash/lodash`,
    ], [
      `Add a package from a specific branch of a GitHub repository to the current workspace using the GitHub protocol (shorthand)`,
      `$0 add lodash-es@lodash/lodash#es`,
    ]],
  });

  @Command.Path(`add`)
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

      const target = suggestTarget(workspace, request, {
        dev: this.dev,
        peer: this.peer,
        preferDev: this.preferDev,
        optional: this.optional,
      });

      const suggestions = await suggestUtils.getSuggestedDescriptors(request, {project, workspace, cache, target, modifier, strategies, maxResults});

      return [request, suggestions, target] as [Descriptor, Array<suggestUtils.Suggestion>, suggestUtils.Target];
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
      Descriptor,
      Array<suggestUtils.Strategy>
    ]> = [];

    const afterWorkspaceDependencyReplacementList: Array<[
      Workspace,
      suggestUtils.Target,
      Descriptor,
      Descriptor
    ]> = [];

    for (const [/*request*/, suggestions, target] of allSuggestions) {
      let selected: Descriptor;

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
          message: `Which range do you want to use?`,
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

        if (this.optional) {
          if (target === `dependencies`) {
            workspace.manifest.ensureDependencyMeta({
              ...selected,
              range: `unknown`,
            }).optional = true;
          } else if (target === `peerDependencies`) {
            workspace.manifest.ensurePeerDependencyMeta({
              ...selected,
              range: `unknown`,
            }).optional = true;
          }
        }

        if (typeof current === `undefined`) {
          afterWorkspaceDependencyAdditionList.push([
            workspace,
            target,
            selected,
            strategies,
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

    const installReport = await StreamReport.start({
      configuration,
      json: this.json,
      stdout: this.context.stdout,
      includeLogs: !this.context.quiet,
    }, async report => {
      await project.install({cache, report});
    });

    return installReport.exitCode();
  }
}

function suggestTarget(workspace: Workspace, ident: Ident, {dev, peer, preferDev, optional}: {dev: boolean, peer: boolean, preferDev: boolean, optional: boolean}) {
  const hasRegular = workspace.manifest[suggestUtils.Target.REGULAR].has(ident.identHash);
  const hasDev = workspace.manifest[suggestUtils.Target.DEVELOPMENT].has(ident.identHash);
  const hasPeer = workspace.manifest[suggestUtils.Target.PEER].has(ident.identHash);

  if ((dev || peer) && hasRegular)
    throw new UsageError(`Package "${structUtils.prettyIdent(workspace.project.configuration, ident)}" is already listed as a regular dependency - remove the -D,-P flags or remove it from your dependencies first`);
  if (!dev && !peer && hasPeer)
    throw new UsageError(`Package "${structUtils.prettyIdent(workspace.project.configuration, ident)}" is already listed as a peer dependency - use either of -D or -P, or remove it from your peer dependencies first`);

  if (optional && hasDev)
    throw new UsageError(`Package "${structUtils.prettyIdent(workspace.project.configuration, ident)}" is already listed as a dev dependency - remove the -O flag or remove it from your dev dependencies first`);

  if (optional && !peer && hasPeer)
    throw new UsageError(`Package "${structUtils.prettyIdent(workspace.project.configuration, ident)}" is already listed as a peer dependency - remove the -O flag or add the -P flag or remove it from your peer dependencies first`);

  if ((dev || preferDev) && optional)
    throw new UsageError(`Package "${structUtils.prettyIdent(workspace.project.configuration, ident)}" cannot simultaneously be a dev dependency and an optional dependency`);


  if (peer)
    return suggestUtils.Target.PEER;
  if (dev || preferDev)
    return suggestUtils.Target.DEVELOPMENT;

  if (hasRegular)
    return suggestUtils.Target.REGULAR;
  if (hasDev)
    return suggestUtils.Target.DEVELOPMENT;

  return suggestUtils.Target.REGULAR;
}
