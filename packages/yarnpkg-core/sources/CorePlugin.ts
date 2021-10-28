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
      for (const {pattern, reference} of project.topLevelWorkspace.manifest.resolutions) {
        if (pattern.from && pattern.from.fullName !== structUtils.stringifyIdent(locator))
          continue;
        if (pattern.from && pattern.from.description && pattern.from.description !== locator.reference)
          continue;

        if (pattern.descriptor.fullName !== structUtils.stringifyIdent(dependency))
          continue;
        if (pattern.descriptor.description && pattern.descriptor.description !== dependency.range)
          continue;

        const alias = resolver.bindDescriptor(
          structUtils.makeDescriptor(dependency, reference),
          project.topLevelWorkspace.anchoredLocator,
          resolveOptions,
        );

        return alias;
      }

      return dependency;
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
