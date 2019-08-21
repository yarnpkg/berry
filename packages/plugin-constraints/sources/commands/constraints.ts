import {BaseCommand}                                         from '@berry/cli';
import {Configuration, IdentHash, Ident, Project, Workspace} from '@berry/core';
import {MessageName, StreamReport, AllDependencies, Report}  from '@berry/core';
import {structUtils}                                         from '@berry/core';
import {Command}                                             from 'clipanion';
import getPath                                               from 'lodash/get';
import setPath                                               from 'lodash/set';
import unsetPath                                             from 'lodash/unset';

import {Constraints, EnforcedDependency, EnforcedField}      from '../Constraints';

// eslint-disable-next-line arca/no-default-export
export default class ConstraintsCheckCommand extends BaseCommand {
  @Command.Boolean(`--fix`)
  fix: boolean = false;

  static usage = Command.Usage({
    category: `Constraints-related commands`,
    description: `check that the project constraints are met`,
    details: `
      This command will run constraints on your project and emit errors for each one that is found but isn't met. If any error is emitted the process will exit with a non-zero exit code.

      If the \`--fix\` flag is used, Yarn will attempt to automatically fix the issues the best it can, following a multi-pass process (with a maximum of 10 iterations). Some ambiguous patterns cannot be autofixed, in which case you'll have to manually specify the right resolution.

      For more information as to how to write constraints, please consult our dedicated page on our website: https://yarnpkg.github.io/berry/features/constraints.
    `,
    examples: [[
      `Check that all constraints are satisfied`,
      `yarn constraints`,
    ], [
      `Autofix all unmet constraints`,
      `yarn constraints --fix`,
    ]],
  });

  @Command.Path(`constraints`)
  async execute() {
    let report: StreamReport;

    let fixPass = 0;
    let hasFixes = false;

    do {
      hasFixes = false;

      const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
      const {project} = await Project.find(configuration, this.context.cwd);
      const constraints = await Constraints.find(project);

      report = await StreamReport.start({
        configuration,
        stdout: this.context.stdout,
      }, async report => {
        const result = await constraints.process();

        hasFixes = await processDependencyConstraints(result.enforcedDependencies, {
          fix: this.fix,
          configuration,
          report,
        }) || hasFixes;

        hasFixes = await processFieldConstraints(result.enforcedFields, {
          fix: this.fix,
          configuration,
          report,
        }) || hasFixes;
      });
    } while (this.fix && fixPass < 10 && hasFixes && !report.hasErrors());

    return report.exitCode();
  }
}

async function processDependencyConstraints(enforcedDependencies: Array<EnforcedDependency>, {configuration, fix, report}: {configuration: Configuration, fix: boolean, report: Report}) {
  let hasFixes = false;

  const allIdents: Map<IdentHash, Ident> = new Map();
  const byWorkspaces: Map<Workspace, Map<IdentHash, Map<AllDependencies, Set<string | null>>>> = new Map();

  for (const {workspace, dependencyIdent, dependencyRange, dependencyType} of enforcedDependencies) {
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
        const expectedRanges = [...byDependencyTypeStore];
        if (expectedRanges.length > 2) {
          report.reportError(MessageName.CONSTRAINTS_AMBIGUITY, `${structUtils.prettyWorkspace(configuration, workspace)} must depend on ${structUtils.prettyIdent(configuration, dependencyIdent)} via conflicting ranges ${expectedRanges.slice(0, -1).map(expectedRange => structUtils.prettyRange(configuration, String(expectedRange))).join(`, `)}, and ${structUtils.prettyRange(configuration, String(expectedRanges[expectedRanges.length - 1]))} (in ${dependencyType})`);
        } else if (expectedRanges.length > 1) {
          report.reportError(MessageName.CONSTRAINTS_AMBIGUITY, `${structUtils.prettyWorkspace(configuration, workspace)} must depend on ${structUtils.prettyIdent(configuration, dependencyIdent)} via conflicting ranges ${structUtils.prettyRange(configuration, String(expectedRanges[0]))} and ${structUtils.prettyRange(configuration, String(expectedRanges[1]))} (in ${dependencyType})`);
        } else {
          const dependencyDescriptor = workspace.manifest[dependencyType].get(dependencyIdent.identHash);
          const [expectedRange] = expectedRanges;

          if (expectedRange !== null) {
            if (!dependencyDescriptor) {
              if (fix) {
                workspace.manifest[dependencyType].set(dependencyIdent.identHash, structUtils.makeDescriptor(dependencyIdent, expectedRange));
                hasFixes = true;
              } else {
                report.reportError(MessageName.CONSTRAINTS_MISSING_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} must depend on ${structUtils.prettyIdent(configuration, dependencyIdent)} (via ${structUtils.prettyRange(configuration, expectedRange)}), but doesn't (in ${dependencyType})`);
              }
            } else if (dependencyDescriptor.range !== expectedRange) {
              if (fix) {
                workspace.manifest[dependencyType].set(dependencyIdent.identHash, structUtils.makeDescriptor(dependencyIdent, expectedRange));
                hasFixes = true;
              } else {
                report.reportError(MessageName.CONSTRAINTS_INCOMPATIBLE_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} must depend on ${structUtils.prettyIdent(configuration, dependencyIdent)} via ${structUtils.prettyRange(configuration, expectedRange)}, but uses ${structUtils.prettyRange(configuration, dependencyDescriptor.range)} instead (in ${dependencyType})`);
              }
            }
          } else {
            if (dependencyDescriptor) {
              if (fix) {
                workspace.manifest[dependencyType].delete(dependencyIdent.identHash);
                hasFixes = true;
              } else {
                report.reportError(MessageName.CONSTRAINTS_EXTRANEOUS_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} has an extraneous dependency on ${structUtils.prettyIdent(configuration, dependencyIdent)} (in ${dependencyType})`);
              }
            }
          }
        }
      }
    }
  }

  return hasFixes;
}

async function processFieldConstraints(enforcedFields: Array<EnforcedField>, {configuration, fix, report}: {configuration: Configuration, fix: boolean, report: Report}) {
  let hasFixes = false;

  const byWorkspaces: Map<Workspace, Map<string, Set<string | null>>> = new Map();

  for (const {workspace, fieldPath, fieldValue} of enforcedFields) {
    let byWorkspacesStore = byWorkspaces.get(workspace);
    if (typeof byWorkspacesStore === `undefined`)
      byWorkspaces.set(workspace, byWorkspacesStore = new Map());

    let byPathStore = byWorkspacesStore.get(fieldPath);
    if (typeof byPathStore === `undefined`)
      byWorkspacesStore.set(fieldPath, byPathStore = new Set());

    byPathStore.add(fieldValue);
  }

  for (const [workspace, byWorkspacesStore] of byWorkspaces) {
    for (const [fieldPath, byPathStore] of byWorkspacesStore) {
      const expectedValues = [...byPathStore];
      if (expectedValues.length > 2) {
        report.reportError(MessageName.CONSTRAINTS_AMBIGUITY, `${structUtils.prettyWorkspace(configuration, workspace)} must have a field ${configuration.format(fieldPath, `cyan`)} set to conflicting values ${expectedValues.slice(0, -1).map(expectedValue => configuration.format(String(expectedValue), `magenta`)).join(`, `)}, or ${configuration.format(String(expectedValues[expectedValues.length - 1]), `magenta`)}`);
      } else if (expectedValues.length > 1) {
        report.reportError(MessageName.CONSTRAINTS_AMBIGUITY, `${structUtils.prettyWorkspace(configuration, workspace)} must have a field ${configuration.format(fieldPath, `cyan`)} set to conflicting values ${configuration.format(String(expectedValues[0]), `magenta`)} or ${configuration.format(String(expectedValues[1]), `magenta`)}`);
      } else {
        const actualValue = getPath(workspace.manifest.raw, fieldPath);
        const [expectedValue] = expectedValues;

        if (expectedValue !== null) {
          if (actualValue === undefined) {
            if (fix) {
              await setWorkspaceField(workspace, fieldPath, expectedValue);
              hasFixes = true;
            } else {
              report.reportError(MessageName.CONSTRAINTS_MISSING_FIELD, `${structUtils.prettyWorkspace(configuration, workspace)} must have a field ${configuration.format(fieldPath, `cyan`)} set to ${configuration.format(String(expectedValue), `magenta`)}, but doesn't`);
            }
          } else if (JSON.stringify(actualValue) !== expectedValue) {
            if (fix) {
              await setWorkspaceField(workspace, fieldPath, expectedValue);
              hasFixes = true;
            } else {
              report.reportError(MessageName.CONSTRAINTS_INCOMPATIBLE_FIELD, `${structUtils.prettyWorkspace(configuration, workspace)} must have a field ${configuration.format(fieldPath, `cyan`)} set to ${configuration.format(String(expectedValue), `magenta`)}, but is set to ${configuration.format(JSON.stringify(actualValue), `magenta`)} instead`);
            }
          }
        } else {
          if (actualValue !== undefined && actualValue !== null) {
            if (fix) {
              await setWorkspaceField(workspace, fieldPath, null);
              hasFixes = true;
            } else {
              report.reportError(MessageName.CONSTRAINTS_EXTRANEOUS_FIELD, `${structUtils.prettyWorkspace(configuration, workspace)} has an extraneous field ${configuration.format(fieldPath, `cyan`)} set to ${configuration.format(String(expectedValue), `magenta`)}`);
            }
          }
        }
      }
    }
  }

  return hasFixes;
}

async function setWorkspaceField(workspace: Workspace, fieldPath: string, value: string | null) {
  if (value === null)
    unsetPath(workspace.manifest.raw, fieldPath);
  else
    setPath(workspace.manifest.raw, fieldPath, JSON.parse(value));

  await workspace.persistRawManifest();
}
