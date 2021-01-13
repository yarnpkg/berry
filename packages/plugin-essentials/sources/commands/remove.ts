import {BaseCommand, WorkspaceRequiredError}                                from '@yarnpkg/cli';
import {Configuration, Cache, Descriptor, Project, formatUtils, FormatType} from '@yarnpkg/core';
import {StreamReport, Workspace}                                            from '@yarnpkg/core';
import {structUtils}                                                        from '@yarnpkg/core';
import {Command, Option, Usage, UsageError}                                 from 'clipanion';
import micromatch                                                           from 'micromatch';

import * as suggestUtils                                                    from '../suggestUtils';
import {Hooks}                                                              from '..';

// eslint-disable-next-line arca/no-default-export
export default class RemoveCommand extends BaseCommand {
  static paths = [
    [`remove`],
  ];

  static usage: Usage = Command.Usage({
    description: `remove dependencies from the project`,
    details: `
      This command will remove the packages matching the specified patterns from the current workspace.

      This command accepts glob patterns as arguments (if valid Idents and supported by [micromatch](https://github.com/micromatch/micromatch)). Make sure to escape the patterns, to prevent your own shell from trying to expand them.
    `,
    examples: [[
      `Remove a dependency from the current project`,
      `$0 remove lodash`,
    ], [
      `Remove a dependency from all workspaces at once`,
      `$0 remove lodash --all`,
    ], [
      `Remove all dependencies starting with \`eslint-\``,
      `$0 remove 'eslint-*'`,
    ], [
      `Remove all dependencies with the \`@babel\` scope`,
      `$0 remove '@babel/*'`,
    ], [
      `Remove all dependencies matching \`react-dom\` or \`react-helmet\``,
      `$0 remove 'react-{dom,helmet}'`,
    ]],
  });

  all = Option.Boolean(`-A,--all`, false, {
    description: `Apply the operation to all workspaces from the current project`,
  });

  patterns = Option.Rest();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.restoreInstallState({
      restoreResolutions: false,
    });

    const affectedWorkspaces = this.all
      ? project.workspaces
      : [workspace];

    const targets = [
      suggestUtils.Target.REGULAR,
      suggestUtils.Target.DEVELOPMENT,
      suggestUtils.Target.PEER,
    ];

    const unreferencedPatterns = [];
    let hasChanged = false;

    const afterWorkspaceDependencyRemovalList: Array<[
      Workspace,
      suggestUtils.Target,
      Descriptor,
    ]> = [];

    for (const pattern of this.patterns) {
      let isReferenced = false;

      // This isn't really needed - It's just for consistency:
      // All patterns are either valid or not for all commands (e.g. remove, up)
      const pseudoIdent = structUtils.parseIdent(pattern);

      for (const workspace of affectedWorkspaces) {
        const peerDependenciesMeta = [...workspace.manifest.peerDependenciesMeta.keys()];
        for (const stringifiedIdent of micromatch(peerDependenciesMeta, pattern)) {
          workspace.manifest.peerDependenciesMeta.delete(stringifiedIdent);

          hasChanged = true;
          isReferenced = true;
        }

        for (const target of targets) {
          const descriptors = workspace.manifest.getForScope(target);
          const stringifiedIdents = [...descriptors.values()].map(descriptor => {
            return structUtils.stringifyIdent(descriptor);
          });

          for (const stringifiedIdent of micromatch(stringifiedIdents, structUtils.stringifyIdent(pseudoIdent))) {
            const {identHash} = structUtils.parseIdent(stringifiedIdent);

            const removedDescriptor = descriptors.get(identHash);
            if (typeof removedDescriptor === `undefined`)
              throw new Error(`Assertion failed: Expected the descriptor to be registered`);

            workspace.manifest[target].delete(identHash);

            afterWorkspaceDependencyRemovalList.push([
              workspace,
              target,
              removedDescriptor,
            ]);

            hasChanged = true;
            isReferenced = true;
          }
        }
      }

      if (!isReferenced) {
        unreferencedPatterns.push(pattern);
      }
    }

    const patterns = unreferencedPatterns.length > 1
      ? `Patterns`
      : `Pattern`;

    const dont = unreferencedPatterns.length > 1
      ? `don't`
      : `doesn't`;

    const which = this.all
      ? `any`
      : `this`;

    if (unreferencedPatterns.length > 0)
      throw new UsageError(`${patterns} ${formatUtils.prettyList(configuration, unreferencedPatterns, FormatType.CODE)} ${dont} match any packages referenced by ${which} workspace`);

    if (hasChanged) {
      await configuration.triggerMultipleHooks(
        (hooks: Hooks) => hooks.afterWorkspaceDependencyRemoval,
        afterWorkspaceDependencyRemovalList,
      );

      const report = await StreamReport.start({
        configuration,
        stdout: this.context.stdout,
      }, async report => {
        await project.install({cache, report});
      });

      return report.exitCode();
    }

    return 0;
  }
}
