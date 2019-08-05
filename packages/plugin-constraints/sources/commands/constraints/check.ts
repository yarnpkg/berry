import {CommandContext, Configuration, IdentHash, Ident, Project, Workspace} from '@berry/core';
import {MessageName, StreamReport, AllDependencies}                          from '@berry/core';
import {structUtils}                                                         from '@berry/core';
import {Command}                                                             from 'clipanion';
import getPath                                                               from 'lodash.get';

import {Constraints}                                                         from '../../Constraints';

// eslint-disable-next-line arca/no-default-export
export default class ConstraintsCheckCommand extends Command<CommandContext> {
  static usage = Command.Usage({
    category: `Constraints-related commands`,
    description: `check that the project constraints are met`,
    details: `
      This command will run constraints on your project and emit errors for each one that is found but isn't met. If any error is emitted the process will exit with a non-zero exit code.

      For more information as to how to write constraints, please consult our dedicated page on our website: .
    `,
    examples: [[
      `Check that all constraints are satisfied`,
      `yarn constraints check`,
    ]],
  });

  @Command.Path(`constraints`, `check`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);
    const constraints = await Constraints.find(project);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      const result = await constraints.process();

      const allIdents: Map<IdentHash, Ident> = new Map();
      const byWorkspaces: Map<Workspace, Map<IdentHash, Map<AllDependencies, Set<string | null>>>> = new Map();

      for (const {workspace, dependencyIdent, dependencyRange, dependencyType} of result.enforcedDependencies) {
        let byWorkspacesStore = byWorkspaces.get(workspace);
        if (typeof byWorkspacesStore === `undefined`)
          byWorkspaces.set(workspace, byWorkspacesStore = new Map());

        let byIdentStore = byWorkspacesStore.get(dependencyIdent.identHash);
        if (typeof byIdentStore === `undefined`)
          byWorkspacesStore.set(dependencyIdent.identHash, byIdentStore = new Map());

        let byDependencyTypeStore = byIdentStore.get(dependencyType);
        if (typeof byDependencyTypeStore === `undefined`)
          byIdentStore.set(dependencyType, byDependencyTypeStore = new Set());

        allIdents.set(dependencyIdent.identHash, dependencyIdent);
        byDependencyTypeStore.add(dependencyRange);
      }

      for (const [workspace, byWorkspacesStore] of byWorkspaces) {
        for (const [identHash, byIdentStore] of byWorkspacesStore) {
          const dependencyIdent = allIdents.get(identHash);
          if (typeof dependencyIdent === `undefined`)
            throw new Error(`Assertion failed: The ident should have been registered`);

          for (const [dependencyType, byDependencyTypeStore] of byIdentStore) {
            const dependencyRanges = [...byDependencyTypeStore];
            if (byDependencyTypeStore.size > 2) {
              report.reportError(MessageName.CONSTRAINTS_MISSING_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} must depend on ${structUtils.prettyIdent(configuration, dependencyIdent)} via conflicting dependencies ${structUtils.prettyRange(configuration, String(dependencyRanges[0]))} and  ${structUtils.prettyRange(configuration, String(dependencyRanges[1]))} in ${dependencyType}`);
            } else if (byDependencyTypeStore.size > 1) {
              report.reportError(MessageName.CONSTRAINTS_MISSING_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} must depend on ${structUtils.prettyIdent(configuration, dependencyIdent)} via conflicting dependencies ${dependencyRanges.slice(0, -1).map(dependencyRange => structUtils.prettyRange(configuration, String(dependencyRange))).join(`, `)}, and ${structUtils.prettyRange(configuration, String(dependencyRanges[dependencyRanges.length - 1]))} in ${dependencyType}`);
            } else {
              const dependencyDescriptor = workspace.manifest[dependencyType].get(dependencyIdent.identHash);
              const [dependencyRange] = dependencyRanges;

              if (dependencyRange !== null) {
                if (!dependencyDescriptor) {
                  report.reportError(MessageName.CONSTRAINTS_MISSING_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} must depend on ${structUtils.prettyIdent(configuration, dependencyIdent)} (via ${structUtils.prettyRange(configuration, dependencyRange)}) in ${dependencyType}, but doesn't`);
                } else if (dependencyDescriptor.range !== dependencyRange) {
                  report.reportError(MessageName.CONSTRAINTS_INCOMPATIBLE_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} must depend on ${structUtils.prettyIdent(configuration, dependencyIdent)} via ${structUtils.prettyRange(configuration, dependencyRange)} in ${dependencyType}, but uses ${structUtils.prettyRange(configuration, dependencyDescriptor.range)} instead`);
                }
              } else {
                if (dependencyDescriptor) {
                  report.reportError(MessageName.CONSTRAINTS_EXTRANEOUS_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} has an extraneous dependency on ${structUtils.prettyIdent(configuration, dependencyIdent)} in ${dependencyType}`);
                }
              }
            }
          }
        }
      }

      for (const {workspace, fieldPath, fieldValue} of result.enforcedFields) {
        const actualValue = getPath(workspace.manifest.raw, fieldPath);

        if (fieldValue !== null) {
          if (actualValue === undefined) {
            report.reportError(MessageName.CONSTRAINTS_MISSING_FIELD, `${structUtils.prettyWorkspace(configuration, workspace)} must have field "${fieldPath}" value ${JSON.stringify(fieldValue)}, but doesn't`);
          } else if (actualValue !== fieldValue && `${actualValue}` !== fieldValue) {
            report.reportError(MessageName.CONSTRAINTS_INCOMPATIBLE_FIELD, `${structUtils.prettyWorkspace(configuration, workspace)} must have field "${fieldPath}" with value ${JSON.stringify(fieldValue)} but it has value ${JSON.stringify(actualValue)}`);
          }
        } else {
          if (actualValue !== undefined && actualValue !== null) {
            report.reportError(MessageName.CONSTRAINTS_EXTRANEOUS_FIELD, `${structUtils.prettyWorkspace(configuration, workspace)} has an extraneous field "${fieldPath}" with value ${JSON.stringify(actualValue)}`);
          }
        }
      }
    });

    return report.exitCode();
  }
}
