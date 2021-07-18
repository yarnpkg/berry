import {BaseCommand, WorkspaceRequiredError}                        from '@yarnpkg/cli';
import {Cache, Configuration, Descriptor, LightReport, MessageName} from '@yarnpkg/core';
import {Project, StreamReport, Workspace, Ident, InstallMode}       from '@yarnpkg/core';
import {structUtils}                                                from '@yarnpkg/core';
import {PortablePath}                                               from '@yarnpkg/fslib';
import {Command, Option, Usage, UsageError}                         from 'clipanion';
import {prompt}                                                     from 'enquirer';
import * as t                                                       from 'typanion';

import * as suggestUtils                                            from '../suggestUtils';
import {Hooks}                                                      from '..';

// eslint-disable-next-line arca/no-default-export
export default class AddCommand extends BaseCommand {
  static paths = [
    [`add`],
  ];

  static usage: Usage = Command.Usage({
    description: `add dependencies to the project`,
    details: `
      This command adds a package to the package.json for the nearest workspace.

      - If it didn't exist before, the package will by default be added to the regular \`dependencies\` field, but this behavior can be overriden thanks to the \`-D,--dev\` flag (which will cause the dependency to be added to the \`devDependencies\` field instead) and the \`-P,--peer\` flag (which will do the same but for \`peerDependencies\`).

      - If the package was already listed in your dependencies, it will by default be upgraded whether it's part of your \`dependencies\` or \`devDependencies\` (it won't ever update \`peerDependencies\`, though).

      - If set, the \`--prefer-dev\` flag will operate as a more flexible \`-D,--dev\` in that it will add the package to your \`devDependencies\` if it isn't already listed in either \`dependencies\` or \`devDependencies\`, but it will also happily upgrade your \`dependencies\` if that's what you already use (whereas \`-D,--dev\` would throw an exception).

      - If set, the \`-O,--optional\` flag will add the package to the \`optionalDependencies\` field and, in combination with the \`-P,--peer\` flag, it will add the package as an optional peer dependency. If the package was already listed in your \`dependencies\`, it will be upgraded to \`optionalDependencies\`. If the package was already listed in your \`peerDependencies\`, in combination with the \`-P,--peer\` flag, it will be upgraded to an optional peer dependency: \`"peerDependenciesMeta": { "<package>": { "optional": true } }\`

      - If the added package doesn't specify a range at all its \`latest\` tag will be resolved and the returned version will be used to generate a new semver range (using the \`^\` modifier by default unless otherwise configured via the \`defaultSemverRangePrefix\` configuration, or the \`~\` modifier if \`-T,--tilde\` is specified, or no modifier at all if \`-E,--exact\` is specified). Two exceptions to this rule: the first one is that if the package is a workspace then its local version will be used, and the second one is that if you use \`-P,--peer\` the default range will be \`*\` and won't be resolved at all.

      - If the added package specifies a range (such as \`^1.0.0\`, \`latest\`, or \`rc\`), Yarn will add this range as-is in the resulting package.json entry (in particular, tags such as \`rc\` will be encoded as-is rather than being converted into a semver range).

      If the \`--cached\` option is used, Yarn will preferably reuse the highest version already used somewhere within the project, even if through a transitive dependency.

      If the \`-i,--interactive\` option is used (or if the \`preferInteractive\` settings is toggled on) the command will first try to check whether other workspaces in the project use the specified package and, if so, will offer to reuse them.

      If the \`--mode=<mode>\` option is set, Yarn will change which artifacts are generated. The modes currently supported are:

      - \`skip-build\` will not run the build scripts at all. Note that this is different from setting \`enableScripts\` to false because the later will disable build scripts, and thus affect the content of the artifacts generated on disk, whereas the former will just disable the build step - but not the scripts themselves, which just won't run.

      - \`update-lockfile\` will skip the link step altogether, and only fetch packages that are missing from the lockfile (or that have no associated checksums). This mode is typically used by tools like Renovate or Dependabot to keep a lockfile up-to-date without incurring the full install cost.

      For a compilation of all the supported protocols, please consult the dedicated page from our website: https://yarnpkg.com/features/protocols.
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

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
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

  dev = Option.Boolean(`-D,--dev`, false, {
    description: `Add a package as a dev dependency`,
  });

  peer = Option.Boolean(`-P,--peer`, false, {
    description: `Add a package as a peer dependency`,
  });

  optional = Option.Boolean(`-O,--optional`, false, {
    description: `Add / upgrade a package to an optional regular / peer dependency`,
  });

  preferDev = Option.Boolean(`--prefer-dev`, false, {
    description: `Add / upgrade a package to a dev dependency`,
  });

  interactive = Option.Boolean(`-i,--interactive`, false, {
    description: `Reuse the specified package from other workspaces in the project`,
  });

  cached = Option.Boolean(`--cached`, false, {
    description: `Reuse the highest version already used somewhere within the project`,
  });

  mode = Option.String(`--mode`, {
    description: `Change what artifacts installs generate`,
    validator: t.isEnum(InstallMode),
  });

  packages = Option.Rest();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.restoreInstallState({
      restoreResolutions: false,
    });

    const interactive = this.interactive ?? configuration.get(`preferInteractive`);

    const modifier = suggestUtils.getModifier(this, project);

    const strategies = [
      ...interactive ? [
        suggestUtils.Strategy.REUSE,
      ] : [],
      suggestUtils.Strategy.PROJECT,
      ...this.cached ? [
        suggestUtils.Strategy.CACHE,
      ] : [],
      suggestUtils.Strategy.LATEST,
    ];

    const maxResults = interactive
      ? Infinity
      : 1;

    const allSuggestions = await Promise.all(this.packages.map(async pseudoDescriptor => {
      const request = pseudoDescriptor.match(/^\.{0,2}\//)
        ? await suggestUtils.extractDescriptorFromPath(pseudoDescriptor as PortablePath, {cwd: this.context.cwd, workspace})
        : structUtils.parseDescriptor(pseudoDescriptor);

      const target = suggestTarget(workspace, request, {
        dev: this.dev,
        peer: this.peer,
        preferDev: this.preferDev,
        optional: this.optional,
      });

      const suggestions = await suggestUtils.getSuggestedDescriptors(request, {project, workspace, cache, target, modifier, strategies, maxResults});

      return [request, suggestions, target] as const;
    }));

    const checkReport = await LightReport.start({
      configuration,
      stdout: this.context.stdout,
      suggestInstall: false,
    }, async report => {
      for (const [request, {suggestions, rejections}] of allSuggestions) {
        const nonNullSuggestions = suggestions.filter(suggestion => {
          return suggestion.descriptor !== null;
        });

        if (nonNullSuggestions.length === 0) {
          const [firstError] = rejections;
          if (typeof firstError === `undefined`)
            throw new Error(`Assertion failed: Expected an error to have been set`);

          if (!project.configuration.get(`enableNetwork`))
            report.reportError(MessageName.CANT_SUGGEST_RESOLUTIONS, `${structUtils.prettyDescriptor(configuration, request)} can't be resolved to a satisfying range (note: network resolution has been disabled)`);
          else
            report.reportError(MessageName.CANT_SUGGEST_RESOLUTIONS, `${structUtils.prettyDescriptor(configuration, request)} can't be resolved to a satisfying range`);

          report.reportSeparator();
          report.reportExceptionOnce(firstError);
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
      Array<suggestUtils.Strategy>,
    ]> = [];

    const afterWorkspaceDependencyReplacementList: Array<[
      Workspace,
      suggestUtils.Target,
      Descriptor,
      Descriptor,
    ]> = [];

    for (const [/*request*/, {suggestions}, target] of allSuggestions) {
      let selected: Descriptor;

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
          message: `Which range do you want to use?`,
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
      await project.install({cache, report, mode: this.mode});
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
