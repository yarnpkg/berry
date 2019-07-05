import {WorkspaceRequiredError}                                  from '@berry/cli';
import {Cache, Configuration, LightReport, LocatorHash, Package} from '@berry/core';
import {IdentHash, PluginConfiguration, Project}                 from '@berry/core';
import {miscUtils, structUtils}                                  from '@berry/core';
import {PortablePath}                                            from '@berry/fslib';
import {Writable}                                                from 'stream';
import {asTree}                                                  from 'treeify';

type TreeNode = {[key: string]: TreeNode};

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`why <package> [-R,--recursive] [--peers]`)
  .describe(`display the reason why a package is needed`)

  .detail(`
    This command prints the exact reasons why a package appears in the dependency tree.

    If \`-R,--recursive\` is set, the listing will go in depth and will list, for each workspaces, what are all the paths that lead to the dependency. Note that the display is somewhat optimized in that it will not print the package listing twice for a single package, so if you see a leaf named "Foo" when looking for "Bar", it means that "Foo" already got printed higher in the tree.

    If \`--peers\` is set, the command will also print the peer dependencies that match the specified name.
  `)

  .example(
    `Explain why lodash is used in your project`,
    `yarn why lodash`,
  )

  .action(async ({cwd, stdout, package: packageName, peers, recursive}: {cwd: PortablePath, stdout: Writable, package: string, peers: boolean, recursive: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(cwd);

    const report = await LightReport.start({configuration, stdout}, async (report: LightReport) => {
      await project.resolveEverything({lockfileOnly: true, cache, report});
    });

    if (report.hasErrors())
      return report.exitCode();

    const identHash = structUtils.parseIdent(packageName).identHash;

    const whyTree = recursive
      ? whyRecursive(project, identHash, {configuration, peers})
      : whySimple(project, identHash, {configuration, peers});

    printTree(stdout, whyTree);
  });

function whySimple(project: Project, identHash: IdentHash, {configuration, peers}: {configuration: Configuration, peers: boolean}) {
  const sortedPackages = miscUtils.sortMap(project.storedPackages.values(), pkg => {
    return structUtils.stringifyLocator(pkg);
  })

  const tree = {} as TreeNode;

  for (const pkg of sortedPackages) {
    let node = null;

    for (const dependency of pkg.dependencies.values()) {
      if (!peers && pkg.peerDependencies.has(dependency.identHash))
        continue;

      const resolution = project.storedResolutions.get(dependency.descriptorHash);
      if (!resolution)
        throw new Error(`Assertion failed: The resolution should have been registered`);

      const nextPkg = project.storedPackages.get(resolution);
      if (!nextPkg)
        throw new Error(`Assertion failed: The package should have been registered`);

      if (nextPkg.identHash !== identHash)
        continue;

      if (node === null) {
        node = {} as TreeNode;

        const label = `${structUtils.prettyLocator(configuration, pkg)}`;
        tree[label] = node;
      }

      const label = `${structUtils.prettyLocator(configuration, nextPkg)} (via ${structUtils.prettyRange(configuration, dependency.range)})`;
      node[label] = {};
    }
  }

  return tree;
}

function whyRecursive(project: Project, identHash: IdentHash, {configuration, peers}: {configuration: Configuration, peers: boolean}) {
  const sortedWorkspaces = miscUtils.sortMap(project.workspaces, workspace => {
    return structUtils.stringifyLocator(workspace.anchoredLocator);
  });

  const seen: Set<LocatorHash> = new Set();
  const dependents: Set<LocatorHash> = new Set();

  const markAllDependents = (pkg: Package) => {
    if (seen.has(pkg.locatorHash))
      return dependents.has(pkg.locatorHash);

    seen.add(pkg.locatorHash);

    if (pkg.identHash === identHash) {
      dependents.add(pkg.locatorHash);
      return true;
    }

    let depends = false;

    if (pkg.identHash === identHash)
      depends = true;

    for (const dependency of pkg.dependencies.values()) {
      if (!peers && pkg.peerDependencies.has(dependency.identHash))
        continue;

      const resolution = project.storedResolutions.get(dependency.descriptorHash);
      if (!resolution)
        throw new Error(`Assertion failed: The resolution should have been registered`);

      const nextPkg = project.storedPackages.get(resolution);
      if (!nextPkg)
        throw new Error(`Assertion failed: The package should have been registered`);

      if (markAllDependents(nextPkg)) {
        depends = true;
      }
    }

    if (depends)
      dependents.add(pkg.locatorHash);

    return depends;
  };

  for (const workspace of sortedWorkspaces) {
    const pkg = project.storedPackages.get(workspace.anchoredLocator.locatorHash);
    if (!pkg)
      throw new Error(`Assertion failed: The package should have been registered`);

    markAllDependents(pkg);
  }

  const printed: Set<LocatorHash> = new Set();
  const tree = {} as TreeNode;

  const printAllDependents = (pkg: Package, tree: TreeNode, range: string | null) => {
    if (!dependents.has(pkg.locatorHash))
      return;

    const label = range !== null
      ? `${structUtils.prettyLocator(configuration, pkg)} (via ${structUtils.prettyRange(configuration, range)})`
      : `${structUtils.prettyLocator(configuration, pkg)}`;

    const node = {} as TreeNode;
    tree[label] = node;

    // We don't want to reprint the children for a package that already got
    // printed as part of another branch
    if (printed.has(pkg.locatorHash))
      return;

    printed.add(pkg.locatorHash);

    // We don't want to print the children of our transitive workspace
    // dependencies, as they will be printed in their own top-level branch
    if (range !== null && project.tryWorkspaceByLocator(pkg))
      return;

    for (const dependency of pkg.dependencies.values()) {
      if (!peers && pkg.peerDependencies.has(dependency.identHash))
        continue;

      const resolution = project.storedResolutions.get(dependency.descriptorHash);
      if (!resolution)
        throw new Error(`Assertion failed: The resolution should have been registered`);

      const nextPkg = project.storedPackages.get(resolution);
      if (!nextPkg)
        throw new Error(`Assertion failed: The package should have been registered`);

      printAllDependents(nextPkg, node, dependency.range);
    }
  };

  for (const workspace of sortedWorkspaces) {
    const pkg = project.storedPackages.get(workspace.anchoredLocator.locatorHash);
    if (!pkg)
      throw new Error(`Assertion failed: The package should have been registered`);

    printAllDependents(pkg, tree, null);
  }

  return tree;
}

function printTree(stdout: Writable, tree: TreeNode) {
  let treeOutput = asTree(tree, false, false);

  // A slight hack to add line returns between two workspaces
  treeOutput = treeOutput.replace(/^([├└]─)/gm, `│\n$1`).replace(/^│\n/, ``);

  stdout.write(treeOutput);
}