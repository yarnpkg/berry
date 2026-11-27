import {MessageName}              from './MessageName';
import {Plugin}                   from './Plugin';
import {Project}                  from './Project';
import {Resolver, ResolveOptions} from './Resolver';
import {Workspace}                from './Workspace';
import * as structUtils           from './structUtils';
import {Descriptor, Locator}      from './types';

export const CorePlugin: Plugin = {
  hooks: {
    reduceDependency: (dependency: Descriptor, project: Project, locator: Locator, initialDependency: Descriptor, {resolver, resolveOptions}: {resolver: Resolver, resolveOptions: ResolveOptions}) => {
      const override = project.getResolutionOverride(dependency, locator);
      if (override === null)
        return dependency;

      return resolver.bindDescriptor(override, project.topLevelWorkspace.anchoredLocator, resolveOptions);
    },

    validateProject: async (project: Project, report: {
      reportWarning: (name: MessageName, text: string) => void;
      reportError: (name: MessageName, text: string) => void;
    }) => {
      for (const workspace of project.workspaces) {
        const workspaceName = structUtils.prettyWorkspace(project.configuration, workspace);

        await project.configuration.triggerHook(hooks => {
          return hooks.validateWorkspace;
        }, workspace, {
          reportWarning: (name: MessageName, text: string) => report.reportWarning(name, `${workspaceName}: ${text}`),
          reportError: (name: MessageName, text: string) => report.reportError(name, `${workspaceName}: ${text}`),
        });
      }
    },

    validateWorkspace: async (workspace: Workspace, report: {
      reportWarning: (name: MessageName, text: string) => void;
      reportError: (name: MessageName, text: string) => void;
    }) => {
      // Validate manifest
      const {manifest} = workspace;

      if (manifest.resolutions.length && workspace.cwd !== workspace.project.cwd)
        manifest.errors.push(new Error(`Resolutions field will be ignored`));

      for (const manifestError of manifest.errors) {
        report.reportWarning(MessageName.INVALID_MANIFEST, manifestError.message);
      }
    },
  },
};
