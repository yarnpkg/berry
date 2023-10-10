import {BaseCommand}                                                                       from '@yarnpkg/cli';
import {Configuration, Project, Manifest, treeUtils, miscUtils, StreamReport, MessageName} from '@yarnpkg/core';
import {formatUtils}                                                                       from '@yarnpkg/core';
import {Command, Option, Usage}                                                            from 'clipanion';

import {ModernEngine}                                                                      from '../ModernEngine';
import * as constraintUtils                                                                from '../constraintUtils';

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

    await project.restoreInstallState();

    const userConfig = await project.loadUserConfig();

    let engine: constraintUtils.Engine;
    if (userConfig?.constraints) {
      engine = new ModernEngine(project);
    } else {
      const {Constraints} = await import(`../Constraints`);
      engine = await Constraints.find(project);
    }

    let root!: treeUtils.TreeRoot;

    let hasFixableErrors = false;
    let allFixableErrors = false;

    for (let t = this.fix ? 10 : 1; t > 0; --t) {
      const result = await engine.process();
      if (!result)
        break;

      const {
        changedWorkspaces,
        remainingErrors,
      } = constraintUtils.applyEngineReport(project, result, {
        fix: this.fix,
      });

      const updates: Array<Promise<void>> = [];
      for (const [workspace, manifest] of changedWorkspaces) {
        const indent = workspace.manifest.indent;

        workspace.manifest = new Manifest();
        workspace.manifest.indent = indent;
        workspace.manifest.load(manifest);

        updates.push(workspace.persistManifest());
      }

      if (changedWorkspaces.size > 0 && t > 1)
        continue;

      root = constraintUtils.convertReportToRoot(remainingErrors, {configuration});

      hasFixableErrors = false;
      allFixableErrors = true;

      for (const [, workspaceErrors] of remainingErrors) {
        for (const error of workspaceErrors) {
          if (error.fixable) {
            hasFixableErrors = true;
          } else {
            allFixableErrors = false;
          }
        }
      }
    }

    if (root.children.length === 0)
      return 0;

    if (hasFixableErrors) {
      const message = allFixableErrors
        ? `Those errors can all be fixed by running ${formatUtils.pretty(configuration, `yarn constraints --fix`, formatUtils.Type.CODE)}`
        : `Errors prefixed by '⚙' can be fixed by running ${formatUtils.pretty(configuration, `yarn constraints --fix`, formatUtils.Type.CODE)}`;

      await StreamReport.start({
        configuration,
        stdout: this.context.stdout,
        includeNames: false,
        includeFooter: false,
      }, async report => {
        report.reportInfo(MessageName.UNNAMED, message);
        report.reportSeparator();
      });
    }

    root.children = miscUtils.sortMap(root.children, node => {
      return node.value![1];
    });

    treeUtils.emitTree(root, {
      configuration,
      stdout: this.context.stdout,
      json: this.json,
      separators: 1,
    });

    return 1;
  }
}
