import {BaseCommand}                                                    from '@yarnpkg/cli';
import {Configuration, IdentHash, Ident, Project, Workspace, miscUtils} from '@yarnpkg/core';
import {MessageName, StreamReport, AllDependencies}                     from '@yarnpkg/core';
import {structUtils}                                                    from '@yarnpkg/core';
import {Command, Usage}                                                 from 'clipanion';
import getPath                                                          from 'lodash/get';
import setPath                                                          from 'lodash/set';
import unsetPath                                                        from 'lodash/unset';

import {Constraints, EnforcedDependency, EnforcedField}                 from '../Constraints';

// eslint-disable-next-line arca/no-default-export
export default class ConstraintsCheckCommand extends BaseCommand {
  @Command.Boolean(`--fix`)
  fix: boolean = false;

  static usage: Usage = Command.Usage({
    category: `Constraints-related commands`,
    description: `check that the project constraints are met`,
    details: `
      This command will run constraints on your project and emit errors for each one that is found but isn't met. If any error is emitted the process will exit with a non-zero exit code.

      If the \`--fix\` flag is used, Yarn will attempt to automatically fix the issues the best it can, following a multi-pass process (with a maximum of 10 iterations). Some ambiguous patterns cannot be autofixed, in which case you'll have to manually specify the right resolution.

      For more information as to how to write constraints, please consult our dedicated page on our website: https://yarnpkg.com/features/constraints.
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
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);
    const constraints = await Constraints.find(project);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      let allSaves = new Set<Workspace>();
      let errors: Array<[MessageName, string]> = [];

      for (let t = 0, T = this.fix ? 10 : 1; t < T; ++t) {
        errors = [];

        const toSave = new Set<Workspace>();
        const result = await constraints.process();

        await processDependencyConstraints(toSave, errors, result.enforcedDependencies, {
          fix: this.fix,
          configuration,
        });

        await processFieldConstraints(toSave, errors, result.enforcedFields, {
          fix: this.fix,
          configuration,
        });

        allSaves = new Set([
          ...allSaves,
          ...toSave,
        ]);

        // If we didn't apply any change then we can exit the loop
        if (toSave.size === 0) {
          break;
        }
      }

      // save all modified manifests
      await Promise.all([...allSaves].map(async workspace => {
        await workspace.persistManifest();
      }));


      // report all outstanding errors
      for (const [messageName, message] of errors) {
        report.reportError(messageName, message);
      }
    });

    if (report.hasErrors())
      return report.exitCode();

    return 0;
  }
}

async function processDependencyConstraints(toSave: Set<Workspace>, errors: Array<[MessageName, string]>, enforcedDependencies: Array<EnforcedDependency>, {configuration, fix}: {configuration: Configuration, fix: boolean}) {
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
          errors.push([MessageName.CONSTRAINTS_AMBIGUITY, `${structUtils.prettyWorkspace(configuration, workspace)} must depend on ${structUtils.prettyIdent(configuration, dependencyIdent)} via conflicting ranges ${expectedRanges.slice(0, -1).map(expectedRange => structUtils.prettyRange(configuration, String(expectedRange))).join(`, `)}, and ${structUtils.prettyRange(configuration, String(expectedRanges[expectedRanges.length - 1]))} (in ${dependencyType})`]);
        } else if (expectedRanges.length > 1) {
          errors.push([MessageName.CONSTRAINTS_AMBIGUITY, `${structUtils.prettyWorkspace(configuration, workspace)} must depend on ${structUtils.prettyIdent(configuration, dependencyIdent)} via conflicting ranges ${structUtils.prettyRange(configuration, String(expectedRanges[0]))} and ${structUtils.prettyRange(configuration, String(expectedRanges[1]))} (in ${dependencyType})`]);
        } else {
          const dependencyDescriptor = workspace.manifest[dependencyType].get(dependencyIdent.identHash);
          const [expectedRange] = expectedRanges;

          if (expectedRange !== null) {
            if (!dependencyDescriptor) {
              if (fix) {
                workspace.manifest[dependencyType].set(dependencyIdent.identHash, structUtils.makeDescriptor(dependencyIdent, expectedRange));
                toSave.add(workspace);
              } else {
                errors.push([MessageName.CONSTRAINTS_MISSING_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} must depend on ${structUtils.prettyIdent(configuration, dependencyIdent)} (via ${structUtils.prettyRange(configuration, expectedRange)}), but doesn't (in ${dependencyType})`]);
              }
            } else if (dependencyDescriptor.range !== expectedRange) {
              if (fix) {
                workspace.manifest[dependencyType].set(dependencyIdent.identHash, structUtils.makeDescriptor(dependencyIdent, expectedRange));
                toSave.add(workspace);
              } else {
                errors.push([MessageName.CONSTRAINTS_INCOMPATIBLE_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} must depend on ${structUtils.prettyIdent(configuration, dependencyIdent)} via ${structUtils.prettyRange(configuration, expectedRange)}, but uses ${structUtils.prettyRange(configuration, dependencyDescriptor.range)} instead (in ${dependencyType})`]);
              }
            }
          } else {
            if (dependencyDescriptor) {
              if (fix) {
                workspace.manifest[dependencyType].delete(dependencyIdent.identHash);
                toSave.add(workspace);
              } else {
                errors.push([MessageName.CONSTRAINTS_EXTRANEOUS_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} has an extraneous dependency on ${structUtils.prettyIdent(configuration, dependencyIdent)} (in ${dependencyType})`]);
              }
            }
          }
        }
      }
    }
  }
}

async function processFieldConstraints(toSave: Set<Workspace>, errors: Array<[MessageName, string]>, enforcedFields: Array<EnforcedField>, {configuration, fix}: {configuration: Configuration, fix: boolean}) {
  const byWorkspaces: Map<Workspace, Map<string, Set<string | null>>> = new Map();

  for (const {workspace, fieldPath, fieldValue} of enforcedFields) {
    const byWorkspacesStore = miscUtils.getMapWithDefault(byWorkspaces, workspace);
    const byPathStore = miscUtils.getSetWithDefault(byWorkspacesStore, fieldPath);

    byPathStore.add(fieldValue);
  }

  for (const [workspace, byWorkspacesStore] of byWorkspaces) {
    for (const [fieldPath, byPathStore] of byWorkspacesStore) {
      const expectedValues = [...byPathStore];
      if (expectedValues.length > 2) {
        errors.push([MessageName.CONSTRAINTS_AMBIGUITY, `${structUtils.prettyWorkspace(configuration, workspace)} must have a field ${configuration.format(fieldPath, `cyan`)} set to conflicting values ${expectedValues.slice(0, -1).map(expectedValue => configuration.format(String(expectedValue), `magenta`)).join(`, `)}, or ${configuration.format(String(expectedValues[expectedValues.length - 1]), `magenta`)}`]);
      } else if (expectedValues.length > 1) {
        errors.push([MessageName.CONSTRAINTS_AMBIGUITY, `${structUtils.prettyWorkspace(configuration, workspace)} must have a field ${configuration.format(fieldPath, `cyan`)} set to conflicting values ${configuration.format(String(expectedValues[0]), `magenta`)} or ${configuration.format(String(expectedValues[1]), `magenta`)}`]);
      } else {
        const actualValue = getPath(workspace.manifest.raw, fieldPath);
        const [expectedValue] = expectedValues;

        if (expectedValue !== null) {
          if (actualValue === undefined) {
            if (fix) {
              await setWorkspaceField(workspace, fieldPath, expectedValue);
              toSave.add(workspace);
            } else {
              errors.push([MessageName.CONSTRAINTS_MISSING_FIELD, `${structUtils.prettyWorkspace(configuration, workspace)} must have a field ${configuration.format(fieldPath, `cyan`)} set to ${configuration.format(String(expectedValue), `magenta`)}, but doesn't`]);
            }
          } else if (JSON.stringify(actualValue) !== expectedValue) {
            if (fix) {
              await setWorkspaceField(workspace, fieldPath, expectedValue);
              toSave.add(workspace);
            } else {
              errors.push([MessageName.CONSTRAINTS_INCOMPATIBLE_FIELD, `${structUtils.prettyWorkspace(configuration, workspace)} must have a field ${configuration.format(fieldPath, `cyan`)} set to ${configuration.format(String(expectedValue), `magenta`)}, but is set to ${configuration.format(JSON.stringify(actualValue), `magenta`)} instead`]);
            }
          }
        } else {
          if (actualValue !== undefined && actualValue !== null) {
            if (fix) {
              await setWorkspaceField(workspace, fieldPath, null);
              toSave.add(workspace);
            } else {
              errors.push([MessageName.CONSTRAINTS_EXTRANEOUS_FIELD, `${structUtils.prettyWorkspace(configuration, workspace)} has an extraneous field ${configuration.format(fieldPath, `cyan`)} set to ${configuration.format(String(expectedValue), `magenta`)}`]);
            }
          }
        }
      }
    }
  }
}

async function setWorkspaceField(workspace: Workspace, fieldPath: string, value: string | null) {
  if (value === null) {
    unsetPath(workspace.manifest.raw, fieldPath);
  } else {
    setPath(workspace.manifest.raw, fieldPath, JSON.parse(value));
  }
}
