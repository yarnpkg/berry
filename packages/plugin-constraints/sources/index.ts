import {formatUtils, Hooks, MessageName, Plugin, SettingsType} from '@yarnpkg/core';
import {PortablePath}                                          from '@yarnpkg/fslib';

import {ModernEngine}                                          from './ModernEngine';
import ConstraintsQueryCommand                                 from './commands/constraints/query';
import ConstraintsSourceCommand                                from './commands/constraints/source';
import ConstraintsCheckCommand                                 from './commands/constraints';
import * as constraintUtils                                    from './constraintUtils';

export {ConstraintsQueryCommand};
export {ConstraintsSourceCommand};
export {ConstraintsCheckCommand};

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    constraintsPath: PortablePath;
    enableConstraintsChecks: boolean;
  }
}

const plugin: Plugin<Hooks> = {
  configuration: {
    enableConstraintsChecks: {
      description: `If true, constraints will run during installs`,
      type: SettingsType.BOOLEAN,
      default: false,
    },
    constraintsPath: {
      description: `The path of the constraints file.`,
      type: SettingsType.ABSOLUTE_PATH,
      default: `./constraints.pro`,
    },
  },
  commands: [
    ConstraintsQueryCommand,
    ConstraintsSourceCommand,
    ConstraintsCheckCommand,
  ],
  hooks: {
    async validateProjectAfterInstall(project, {reportError}) {
      if (!project.configuration.get(`enableConstraintsChecks`))
        return;

      const userConfig = await project.loadUserConfig();

      let engine: constraintUtils.Engine;
      if (userConfig?.constraints) {
        engine = new ModernEngine(project);
      } else {
        const {Constraints} = await import(`./Constraints`);
        engine = await Constraints.find(project);
      }

      const result = await engine.process();
      if (!result)
        return;

      const {remainingErrors} = constraintUtils.applyEngineReport(project, result);
      if (remainingErrors.size !== 0) {
        if (project.configuration.isCI) {
          for (const [workspace, workspaceErrors] of remainingErrors) {
            for (const error of workspaceErrors) {
              reportError(MessageName.CONSTRAINTS_CHECK_FAILED, `${formatUtils.pretty(project.configuration, workspace.anchoredLocator, formatUtils.Type.IDENT)}: ${error.text}`);
            }
          }
        } else {
          reportError(MessageName.CONSTRAINTS_CHECK_FAILED, `Constraint check failed; run ${formatUtils.pretty(project.configuration, `yarn constraints`, formatUtils.Type.CODE)} for more details`);
        }
      }
    },
  },
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
