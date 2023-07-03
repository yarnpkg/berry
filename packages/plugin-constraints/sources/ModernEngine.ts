import {LocatorHash, Manifest, miscUtils, nodeUtils, Project, structUtils, Workspace} from '@yarnpkg/core';
import {Yarn}                                                                         from '@yarnpkg/types';

import * as constraintUtils                                                           from './constraintUtils';

export class ModernEngine implements constraintUtils.Engine {
  constructor(private project: Project) {
  }

  private createEnvironment() {
    const workspaceIndex = new constraintUtils.Index<Yarn.Constraints.Workspace>([`cwd`, `ident`]);
    const dependencyIndex = new constraintUtils.Index<Yarn.Constraints.Dependency>([`workspace`, `type`, `ident`]);
    const packageIndex = new constraintUtils.Index<Yarn.Constraints.Package>([`ident`]);

    const result: constraintUtils.ProcessResult = {
      manifestUpdates: new Map(),
      reportedErrors: new Map(),
    };

    const packageItems = new Map<LocatorHash, Yarn.Constraints.Package>();
    const workspaceItems = new Map<Workspace, Yarn.Constraints.Workspace>();

    for (const pkg of this.project.storedPackages.values()) {
      const peerDependencies = Array.from(pkg.peerDependencies.values(), descriptor => {
        return [structUtils.stringifyIdent(descriptor), descriptor.range] as const;
      });

      packageItems.set(pkg.locatorHash, {
        workspace: null,
        ident: structUtils.stringifyIdent(pkg),
        version: pkg.version,
        dependencies: new Map(),
        peerDependencies: new Map(peerDependencies.filter(([ident]) => pkg.peerDependenciesMeta.get(ident)?.optional !== true)),
        optionalPeerDependencies: new Map(peerDependencies.filter(([ident]) => pkg.peerDependenciesMeta.get(ident)?.optional === true)),
      });
    }

    for (const pkg of this.project.storedPackages.values()) {
      const packageItem = packageItems.get(pkg.locatorHash)!;

      packageItem.dependencies = new Map(Array.from(pkg.dependencies.values(), descriptor => {
        const resolution = this.project.storedResolutions.get(descriptor.descriptorHash);
        if (typeof resolution === `undefined`)
          throw new Error(`Assertion failed: The resolution should have been registered`);

        const pkg = packageItems.get(resolution);
        if (typeof pkg === `undefined`)
          throw new Error(`Assertion failed: The package should have been registered`);

        return [structUtils.stringifyIdent(descriptor), pkg] as const;
      }));

      packageItem.dependencies.delete(packageItem.ident);
    }

    for (const workspace of this.project.workspaces) {
      const ident = structUtils.stringifyIdent(workspace.anchoredLocator);
      const manifest = workspace.manifest.exportTo({});

      const pkg = packageItems.get(workspace.anchoredLocator.locatorHash);
      if (typeof pkg === `undefined`)
        throw new Error(`Assertion failed: The package should have been registered`);

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

      const errorFn = (message: string) => {
        miscUtils.getArrayWithDefault(result.reportedErrors, workspace.cwd).push(message);
      };

      const workspaceItem = workspaceIndex.insert({
        cwd: workspace.relativeCwd,
        ident,
        manifest,
        pkg,
        set: setFn,
        unset: unsetFn,
        error: errorFn,
      });

      workspaceItems.set(workspace, workspaceItem);

      for (const dependencyType of Manifest.allDependencies) {
        for (const descriptor of workspace.manifest[dependencyType].values()) {
          const ident = structUtils.stringifyIdent(descriptor);

          const deleteFn = () => {
            setFn([dependencyType, ident], undefined, {caller: nodeUtils.getCaller()});
          };

          const updateFn = (range: string) => {
            setFn([dependencyType, ident], range, {caller: nodeUtils.getCaller()});
          };

          let resolutionItem: Yarn.Constraints.Package | null = null;
          if (dependencyType !== `peerDependencies`) {
            if (dependencyType !== `dependencies` || !workspace.manifest.devDependencies.has(descriptor.identHash)) {
              const pkgDescriptor = workspace.anchoredPackage.dependencies.get(descriptor.identHash);

              // The descriptors may be missing if the package was added to the
              // workspace after the constraints were computed (e.g. when using
              // the `yarn constraints --fix` command)
              if (pkgDescriptor) {
                if (typeof pkgDescriptor === `undefined`)
                  throw new Error(`Assertion failed: The dependency should have been registered`);

                const resolution = this.project.storedResolutions.get(pkgDescriptor.descriptorHash);
                if (typeof resolution === `undefined`)
                  throw new Error(`Assertion failed: The resolution should have been registered`);

                const pkgItem = packageItems.get(resolution);
                if (typeof pkgItem === `undefined`)
                  throw new Error(`Assertion failed: The package should have been registered`);

                resolutionItem = pkgItem;
              }
            }
          }

          dependencyIndex.insert({
            workspace: workspaceItem,
            ident,
            range: descriptor.range,
            type: dependencyType,
            resolution: resolutionItem,
            update: updateFn,
            delete: deleteFn,
            error: errorFn,
          });
        }
      }
    }

    for (const pkg of this.project.storedPackages.values()) {
      const workspace = this.project.tryWorkspaceByLocator(pkg);
      if (!workspace)
        continue;

      const workspaceItem = workspaceItems.get(workspace);
      if (typeof workspaceItem === `undefined`)
        throw new Error(`Assertion failed: The workspace should have been registered`);

      const packageItem = packageItems.get(pkg.locatorHash);
      if (typeof packageItem === `undefined`)
        throw new Error(`Assertion failed: The package should have been registered`);

      packageItem.workspace = workspaceItem;
    }

    return {
      workspaces: workspaceIndex,
      dependencies: dependencyIndex,
      packages: packageIndex,
      result,
    };
  }

  async process() {
    const env = this.createEnvironment();

    const context: Yarn.Constraints.Context = {
      Yarn: {
        workspace: ((filter?: Yarn.Constraints.WorkspaceFilter) => {
          return env.workspaces.find(filter)[0] ?? null;
        }) as any,
        workspaces: filter => {
          return env.workspaces.find(filter);
        },

        dependency: ((filter?: Yarn.Constraints.DependencyFilter) => {
          return env.dependencies.find(filter)[0] ?? null;
        }) as any,
        dependencies: filter => {
          return env.dependencies.find(filter);
        },

        package: ((filter?: Yarn.Constraints.PackageFilter) => {
          return env.packages.find(filter)[0] ?? null;
        }) as any,
        packages: filter => {
          return env.packages.find(filter);
        },
      },
    };

    const userConfig = await this.project.loadUserConfig();
    if (!userConfig?.constraints)
      return null;

    await userConfig.constraints(context);

    return env.result;
  }
}
