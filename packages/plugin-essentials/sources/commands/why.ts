import {WorkspaceRequiredError}                                                              from '@berry/cli';
import {Cache, Configuration, LightReport, LocatorHash, Package, Plugin, Project, Workspace} from '@berry/core';
import {structUtils}                                                                         from '@berry/core';
import {Writable}                                                                            from 'stream';
import {asTree}                                                                              from 'treeify';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`why <package> [-v,--verbose]`)
  .describe(`display the reason why a package is needed`)

  .detail(`
    This command prints the exact reasons why a package appears in the dependency tree.

    If \`-v,--verbose\` is true, the output will include the complete package hierarchy between the top-level and the specified package. Otherwise, only the direct dependencies from your workspaces will be printed.
  `)

  .example(
    `Explains why lodash is used in your project`,
    `yarn why lodash`,
  )

  .action(async ({cwd, stdout, package: packageName, verbose}: {cwd: string, stdout: Writable, package: string, verbose: boolean}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(cwd);

    const report = await LightReport.start({configuration, stdout}, async (report: LightReport) => {
      await project.resolveEverything({lockfileOnly: true, cache, report});
    });

    if (report.hasErrors())
      return report.exitCode();

    type TreeNode = {[key: string]: TreeNode};

    const tree = {} as TreeNode;
    const printed = new Set();

    const makeBuilder = (previous: (() => TreeNode | null) | null, pkg: Package) => {
      return () => {
        const target = previous ? previous() : tree;
        if (target === null)
          return null;

        const label = structUtils.prettyLocator(configuration, pkg);
        if (!Object.prototype.hasOwnProperty.call(target, label))
          target[label] = {} as TreeNode;
        
        if ((previous && project.workspacesByLocator.has(pkg.locatorHash)) || printed.has(pkg.locatorHash))
          return null;

        printed.add(pkg.locatorHash);
        return target[label];
      };
    };

    const processWorkspace = (workspace: Workspace) => {
      const workspacePkg = project.storedPackages.get(workspace.anchoredLocator.locatorHash);
      if (!workspacePkg)
        throw new Error(`Assertion failed: The package should have been registered`);

      traversePackage(makeBuilder(null, workspacePkg), workspacePkg, new Set());
    };

    const traversePackage = (builder: () => TreeNode | null, pkg: Package, seen: Set<LocatorHash>) => {
      if (seen.has(pkg.locatorHash))
        return;
      
      if (structUtils.stringifyIdent(pkg) === packageName)
        builder();

      const nextSeen = new Set(seen);
      nextSeen.add(pkg.locatorHash);

      for (const dependency of pkg.dependencies.values()) {
        // We don't want to consider peer dependencies in "yarn why"
        if (pkg.peerDependencies.has(dependency.identHash))
          continue;

        const resolution = project.storedResolutions.get(dependency.descriptorHash);
        if (!resolution)
          throw new Error(`Assertion failed: The resolution should have been registered`);

        const nextPkg = project.storedPackages.get(resolution);
        if (!nextPkg)
          throw new Error(`Assertion failed: The package should have been registered`);

        traversePackage(makeBuilder(builder, nextPkg), nextPkg, nextSeen);
      }
    };

    for (const workspace of project.workspaces)
      processWorkspace(workspace);

    let treeOutput = asTree(tree, false, false);

    // A slight hack to add line returns between two workspaces
    treeOutput = treeOutput.replace(/^([├└]─)/gm, `│\n$1`).replace(/^│\n/, ``);

    stdout.write(treeOutput);
  });
