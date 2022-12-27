import {Manifest, miscUtils, nodeUtils, Project, structUtils} from '@yarnpkg/core';

import * as context                                           from './ModernEngineContext';
import * as constraintUtils                                   from './constraintUtils';

export class ModernEngine implements constraintUtils.Engine {
  constructor(private project: Project) {
  }

  private createEnvironment() {
    const workspaces = new constraintUtils.Index<context.Workspace>([`cwd`, `ident`]);
    const dependencies = new constraintUtils.Index<context.Dependency>([`type`, `ident`]);

    const result: constraintUtils.ProcessResult = {
      manifestUpdates: new Map(),
      reportedErrors: new Map(),
    };

    for (const workspace of this.project.workspaces) {
      const ident = structUtils.stringifyIdent(workspace.anchoredLocator);
      const manifest = workspace.manifest.exportTo({});

      const setFn = (path: Array<string> | string, value: any, {caller = nodeUtils.getCaller()}: {caller?: nodeUtils.Caller | null} = {}) => {
        const normalizedPath = constraintUtils.normalizePath(path);

        const workspaceUpdates = miscUtils.getMapWithDefault(result.manifestUpdates, workspace.cwd);
        const pathUpdates = miscUtils.getMapWithDefault(workspaceUpdates, normalizedPath);

        const constraints = miscUtils.getSetWithDefault(pathUpdates, value);

        if (caller !== null) {
          constraints.add(caller);
        }
      };

      const unsetFn = (path: Array<string> | string) => {
        return setFn(path, undefined, {caller: nodeUtils.getCaller()});
      };

      const workspaceItem = workspaces.insert({
        cwd: workspace.cwd,
        ident,
        manifest,
        set: setFn,
        unset: unsetFn,
      });

      for (const dependencyType of Manifest.allDependencies) {
        for (const descriptor of workspace.manifest[dependencyType].values()) {
          const ident = structUtils.stringifyIdent(descriptor);

          const deleteFn = () => {
            setFn([dependencyType, ident], undefined, {caller: nodeUtils.getCaller()});
          };

          const updateFn = (range: string) => {
            setFn([dependencyType, ident], range, {caller: nodeUtils.getCaller()});
          };

          const errorFn = (message: string) => {
            miscUtils.getArrayWithDefault(result.reportedErrors, workspace.cwd).push(message);
          };

          dependencies.insert({
            workspace: workspaceItem,
            ident,
            range: descriptor.range,
            type: dependencyType,
            update: updateFn,
            delete: deleteFn,
            error: errorFn,
          });
        }
      }
    }

    return {
      workspaces,
      dependencies,
      result,
    };
  }

  async process() {
    const env = this.createEnvironment();

    const context: context.Context = {
      Yarn: {
        workspace: filter => {
          return env.workspaces.find(filter)[0] ?? null;
        },
        workspaces: filter => {
          return env.workspaces.find(filter);
        },
        dependencies: filter => {
          return env.dependencies.find(filter);
        },
      },
    };

    const userConfig = await this.project.loadUserConfig();
    if (!userConfig?.constraints)
      return null;

    userConfig.constraints(context);

    return env.result;
  }
}
