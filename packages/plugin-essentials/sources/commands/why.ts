import {BaseCommand, WorkspaceRequiredError}                          from '@yarnpkg/cli';
import {Configuration, LocatorHash, Package, formatUtils, Descriptor} from '@yarnpkg/core';
import {IdentHash, Project}                                           from '@yarnpkg/core';
import {miscUtils, structUtils, treeUtils}                            from '@yarnpkg/core';
import {Command, Option, Usage}                                       from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class WhyCommand extends BaseCommand {
  static paths = [
    [`why`],
  ];

  static usage: Usage = Command.Usage({
    description: `display the reason why a package is needed`,
    details: `
      This command prints the exact reasons why a package appears in the dependency tree.

      If \`-R,--recursive\` is set, the listing will go in depth and will list, for each workspaces, what are all the paths that lead to the dependency. Note that the display is somewhat optimized in that it will not print the package listing twice for a single package, so if you see a leaf named "Foo" when looking for "Bar", it means that "Foo" already got printed higher in the tree.
    `,
    examples: [[
      `Explain why lodash is used in your project`,
      `$0 why lodash`,
    ]],
  });

  recursive = Option.Boolean(`-R,--recursive`, false, {
    description: `List, for each workspace, what are all the paths that lead to the dependency`,
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  peers = Option.Boolean(`--peers`, false, {
    description: `Also print the peer dependencies that match the specified name`,
  });

  package = Option.String();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.restoreInstallState();

    const identHash = structUtils.parseIdent(this.package).identHash;

    const whyTree = this.recursive
      ? whyRecursive(project, identHash, {configuration, peers: this.peers})
      : whySimple(project, identHash, {configuration, peers: this.peers});

    treeUtils.emitTree(whyTree, {
      configuration,
      stdout: this.context.stdout,
      json: this.json,
      separators: 1,
    });
  }
}

function whySimple(project: Project, identHash: IdentHash, {configuration, peers}: {configuration: Configuration, peers: boolean}) {
  const sortedPackages = miscUtils.sortMap(project.storedPackages.values(), pkg => {
    return structUtils.stringifyLocator(pkg);
  });

  const rootChildren: treeUtils.TreeMap = {};
  const root: treeUtils.TreeNode = {children: rootChildren};

  for (const pkg of sortedPackages) {
    const nodeChildren: treeUtils.TreeMap = {};
    const node: treeUtils.TreeNode | null = null;

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
        const key = structUtils.stringifyLocator(pkg);
        rootChildren[key] = {value: [pkg, formatUtils.Type.LOCATOR], children: nodeChildren};
      }

      const key = structUtils.stringifyLocator(nextPkg);
      nodeChildren[key] = {value: [{
        descriptor: dependency,
        locator: nextPkg,
      }, formatUtils.Type.DEPENDENT]};
    }
  }

  return root;
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

  for (const workspace of sortedWorkspaces)
    markAllDependents(workspace.anchoredPackage);

  const printed: Set<LocatorHash> = new Set();

  const rootChildren: treeUtils.TreeMap = {};
  const root: treeUtils.TreeNode = {children: rootChildren};

  const printAllDependents = (pkg: Package, parentChildren: treeUtils.TreeMap, dependency: Descriptor | null) => {
    if (!dependents.has(pkg.locatorHash))
      return;

    const nodeValue = dependency !== null
      ? formatUtils.tuple(formatUtils.Type.DEPENDENT, {locator: pkg, descriptor: dependency})
      : formatUtils.tuple(formatUtils.Type.LOCATOR, pkg);

    const nodeChildren: treeUtils.TreeMap = {};
    const node: treeUtils.TreeNode = {
      value: nodeValue,
      children: nodeChildren,
    };

    const key = structUtils.stringifyLocator(pkg);
    parentChildren[key] = node;

    // We don't want to print the children of our transitive workspace
    // dependencies, as they will be printed in their own top-level branch
    if (dependency !== null && project.tryWorkspaceByLocator(pkg))
      return;

    // We don't want to reprint the children for a package that already got
    // printed as part of another branch
    if (printed.has(pkg.locatorHash))
      return;

    printed.add(pkg.locatorHash);

    for (const dependency of pkg.dependencies.values()) {
      if (!peers && pkg.peerDependencies.has(dependency.identHash))
        continue;

      const resolution = project.storedResolutions.get(dependency.descriptorHash);
      if (!resolution)
        throw new Error(`Assertion failed: The resolution should have been registered`);

      const nextPkg = project.storedPackages.get(resolution);
      if (!nextPkg)
        throw new Error(`Assertion failed: The package should have been registered`);

      printAllDependents(nextPkg, nodeChildren, dependency);
    }
  };

  for (const workspace of sortedWorkspaces)
    printAllDependents(workspace.anchoredPackage, rootChildren, null);

  return root;
}
