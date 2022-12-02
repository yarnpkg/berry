import {BaseCommand}                                                       from '@yarnpkg/cli';
import {Configuration, Project, Manifest, treeUtils, miscUtils, nodeUtils} from '@yarnpkg/core';
import {formatUtils}                                                       from '@yarnpkg/core';
import {Command, Option, Usage}                                            from 'clipanion';
import get                                                                 from 'lodash/get';
import set                                                                 from 'lodash/set';
import unset                                                               from 'lodash/unset';

import {ModernEngine}                                                      from '../ModernEngine';
import * as constraintUtils                                                from '../constraintUtils';

function formatStackLine(configuration: Configuration, caller: nodeUtils.Caller) {
  // TODO: Should this be in formatUtils? Might not be super useful as a core feature...
  const parts: Array<string> = [];

  if (caller.methodName !== null)
    parts.push(formatUtils.pretty(configuration, caller.methodName, formatUtils.Type.CODE));

  if (caller.file !== null) {
    const fileParts: Array<string> = [];
    fileParts.push(formatUtils.pretty(configuration, caller.file, formatUtils.Type.PATH));

    if (caller.line !== null) {
      fileParts.push(formatUtils.pretty(configuration, caller.line, formatUtils.Type.NUMBER));

      if (caller.column !== null) {
        fileParts.push(formatUtils.pretty(configuration, caller.line, formatUtils.Type.NUMBER));
      }
    }

    parts.push(`(${fileParts.join(formatUtils.pretty(configuration, `:`, `grey`))})`);
  }

  return parts.join(` `);
}

// eslint-disable-next-line arca/no-default-export
export default class ConstraintsCheckCommand extends BaseCommand {
  static paths = [
    [`constraints`],
  ];

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

  fix = Option.Boolean(`--fix`, false, {
    description: `Attempt to automatically fix unambiguous issues, following a multi-pass process`,
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);

    const userConfig = await project.loadUserConfig();

    let engine: constraintUtils.Engine;
    if (userConfig?.constraints) {
      engine = new ModernEngine(project);
    } else {
      const {Constraints} = await import(`../Constraints`);
      engine = await Constraints.find(project);
    }

    let root!: treeUtils.TreeRoot;
    let hasErrors = false;

    for (let t = 0, T = this.fix ? 10 : 1; t < T; ++t) {
      root = {children: []};

      const result = await engine.process();
      if (!result)
        break;

      const updates: Array<Promise<void>> = [];
      for (const [workspaceCwd, workspaceUpdates] of result.manifestUpdates) {
        const workspaceErrors = result.reportedErrors.get(workspaceCwd) ?? [];

        const workspace = project.getWorkspaceByCwd(workspaceCwd);
        const manifest = workspace.manifest.exportTo({});

        let changedWorkspace = false;
        for (const [fieldPath, newValues] of workspaceUpdates) {
          if (newValues.size > 1) {
            const conflictingValuesMessage = [...newValues].map(([value, sources]) => {
              const prettyValue = formatUtils.pretty(configuration, value, formatUtils.Type.INSPECT);

              const stackLine = sources.size > 0
                ? formatStackLine(configuration, sources.values().next().value)
                : null;

              return stackLine !== null
                ? `\n${prettyValue} at ${stackLine}`
                : `\n${prettyValue}`;
            }).join(``);

            workspaceErrors.push(`Conflict detected in constraint targeting ${formatUtils.pretty(configuration, fieldPath, formatUtils.Type.CODE)}; conflicting values are:${conflictingValuesMessage}`);
          } else {
            const [[newValue]] = newValues;

            const currentValue = get(manifest, fieldPath);
            if (currentValue === newValue)
              continue;

            if (!this.fix) {
              const errorMessage = typeof currentValue === `undefined`
                ? `Missing field ${formatUtils.pretty(configuration, fieldPath, formatUtils.Type.CODE)}; expected ${formatUtils.pretty(configuration, newValue, formatUtils.Type.INSPECT)}`
                : typeof newValue === `undefined`
                  ? `Extraneous field ${formatUtils.pretty(configuration, fieldPath, formatUtils.Type.CODE)} currently set to ${formatUtils.pretty(configuration, currentValue, formatUtils.Type.INSPECT)}`
                  : `Invalid field ${formatUtils.pretty(configuration, fieldPath, formatUtils.Type.CODE)}; expected ${formatUtils.pretty(configuration, newValue, formatUtils.Type.INSPECT)}, found ${formatUtils.pretty(configuration, currentValue, formatUtils.Type.INSPECT)}`;

              workspaceErrors.push(errorMessage);
              continue;
            }

            if (typeof newValue === `undefined`)
              unset(manifest, fieldPath);
            else
              set(manifest, fieldPath, newValue);

            changedWorkspace = true;
          }
        }

        if (changedWorkspace) {
          const indent = workspace.manifest.indent;

          workspace.manifest = new Manifest();
          workspace.manifest.indent = indent;
          workspace.manifest.load(manifest);

          updates.push(workspace.persistManifest());
        }

        if (workspaceErrors.length > 0) {
          const errorNodes: Array<treeUtils.TreeNode> = [];
          for (const error of workspaceErrors) {
            const lines = error.split(/\n/);

            errorNodes.push({
              value: formatUtils.tuple(formatUtils.Type.NO_HINT, lines[0]),
              children: lines.slice(1).map(line => ({
                value: formatUtils.tuple(formatUtils.Type.NO_HINT, line),
              })),
            });
          }

          const workspaceNode: treeUtils.TreeNode = {
            value: formatUtils.tuple(formatUtils.Type.LOCATOR, workspace.anchoredLocator),
            children: miscUtils.sortMap(errorNodes, node => node.value![1]),
          };

          root.children.push(workspaceNode);
          hasErrors = true;
        }
      }

      if (updates.length === 0) {
        break;
      }
    }

    root.children = miscUtils.sortMap(root.children, node => {
      return node.value![1];
    });

    if (hasErrors) {
      treeUtils.emitTree(root, {
        configuration,
        stdout: this.context.stdout,
        json: this.json,
        separators: 1,
      });
    }

    return hasErrors ? 1 : 0;
  }
}
