/**
 * High-level node_modules hoisting algorithm recipe
 *
 * 1. Take input dependency graph and start traversing it,
 * as you visit new node in the graph - clone it if there can be multiple paths
 * to access the node from the graph root to the node, e.g. essentially represent
 * the graph with a tree as you go, to make hoisting possible.
 * 2. You want to hoist every node possible to the top root node first,
 * then to each of its children etc, so you need to keep track what is your current
 * root node into which you are hoisting
 * 3. Traverse the dependency graph from the current root node and for each package name
 * that can be potentially hoisted to the current root node build a list of idents
 * in descending hoisting preference. You will check in next steps whether most preferred ident
 * for the given package name can be hoisted first, and if not, then you check the
 * less preferred ident, etc, until either some ident will be hoisted
 * or you run out of idents to check
 * (no need to convert the graph to the tree when you build this preference map).
 * 4. The children of the root node are already "hoisted", so you need to start
 * from the dependencies of these children. You take some child and
 * sort its dependencies so that regular dependencies without peer dependencies
 * will come first and then those dependencies that peer depend on them.
 * This is needed to make algorithm more efficient and hoist nodes which are easier
 * to hoist first and then handle peer dependent nodes.
 * 5. You take this sorted list of dependencies and check if each of them can be
 * hoisted to the current root node. To answer is the node can be hoisted you check
 * your constraints - require promise and peer dependency promise.
 * The possible answers can be: YES - the node is hoistable to the current root,
 * NO - the node is not hoistable to the current root
 * and DEPENDS - the node is hoistable to the root if nodes X, Y, Z are hoistable
 * to the root. The case DEPENDS happens when all the require and other
 * constraints are met, except peer dependency constraints. Note, that the nodes
 * that are not package idents currently at the top of preference list are considered
 * to have the answer NO right away, before doing any other constraint checks.
 * 6. When you have hoistable answer for each dependency of a node you then build
 * a list of nodes that are NOT hoistable. These are the nodes that have answer NO
 * and the nodes that DEPENDS on these nodes. All the other nodes are hoistable,
 * those that have answer YES and those that have answer DEPENDS,
 * because they are cyclically dependent on each another
 * 7. You hoist all the hoistable nodes to the current root and continue traversing
 * the tree. Note, you need to track newly added nodes to the current root,
 * because after you finished tree traversal you want to come back to these new nodes
 * first thing and hoist everything from each of them to the current tree root.
 * 8. After you have finished traversing newly hoisted current root nodes
 * it means you cannot hoist anything to the current tree root and you need to pick
 * the next node as current tree root and run the algorithm again
 * until you run out of candidates for current tree root.
 */
type PackageName = string;
export type HoisterTree = {name: PackageName, identName: PackageName, reference: string, dependencies: Set<HoisterTree>, peerNames: Set<PackageName>};
export type HoisterResult = {name: PackageName, identName: PackageName, references: Set<string>, dependencies: Set<HoisterResult>};
type Locator = string;
type Ident = string;
type HoisterWorkTree = {name: PackageName, references: Set<string>, ident: Ident, locator: Locator, dependencies: Map<PackageName, HoisterWorkTree>, originalDependencies: Map<PackageName, HoisterWorkTree>, hoistedDependencies: Map<PackageName, HoisterWorkTree>, peerNames: ReadonlySet<PackageName>, decoupled: boolean, reasons: Map<PackageName, string>, isHoistBorder: boolean};

/**
 * Mapping which packages depend on a given package alias + ident. It is used to determine hoisting weight,
 * e.g. which one among the group of packages with the same name should be hoisted.
 * The package having the biggest number of parents using this package will be hoisted.
 */
type PreferenceMap = Map<string, { peerDependents: Set<Ident>, dependents: Set<Ident> }>;

enum Hoistable { YES, NO, DEPENDS }
type HoistInfo = {
  isHoistable: Hoistable.YES
} | {
  isHoistable: Hoistable.NO
  reason: string | null
} | {
  isHoistable: Hoistable.DEPENDS
  dependsOn: Set<HoisterWorkTree>
  reason: string | null
}

const makeLocator = (name: string, reference: string) => `${name}@${reference}`;
const makeIdent = (name: string, reference: string) => {
  const hashIdx = reference.indexOf(`#`);
  // Strip virtual reference part, we don't need it for hoisting purposes
  const realReference = hashIdx >= 0 ? reference.substring(hashIdx + 1) : reference!;
  return makeLocator(name, realReference);
};

enum DebugLevel { NONE = -1, PERF = 0, CHECK = 1, REASONS = 2, INTENSIVE_CHECK = 9}

export type HoistOptions = {
  /** Runs self-checks after hoisting is finished */
  check?: boolean;
  /** Debug level */
  debugLevel?: DebugLevel;
  /** Hoist borders are defined by parent node locator and its dependency name. The dependency is considered a border, nothing can be hoisted past this dependency, but dependency can be hoisted */
  hoistingLimits?: Map<Locator, Set<PackageName>>;
}

type InternalHoistOptions = {
  check?: boolean;
  debugLevel: DebugLevel;
  hoistingLimits: Map<Locator, Set<PackageName>>;
}

/**
 * Hoists package tree.
 *
 * The root node of a tree must has id: '.'.
 * This function does not mutate its arguments, it hoists and returns tree copy.
 *
 * @param tree package tree (cycles in the tree are allowed)
 *
 * @returns hoisted tree copy
 */
export const hoist = (tree: HoisterTree, opts: HoistOptions = {}): HoisterResult => {
  const debugLevel = opts.debugLevel || Number(process.env.NM_DEBUG_LEVEL || DebugLevel.NONE);
  const check = opts.check || debugLevel >= DebugLevel.INTENSIVE_CHECK;
  const hoistingLimits = opts.hoistingLimits || new Map();
  const options: InternalHoistOptions = {check, debugLevel, hoistingLimits};

  if (options.debugLevel >= DebugLevel.PERF)
    console.time(`hoist`);

  const treeCopy = cloneTree(tree, options);

  hoistTo(treeCopy, [treeCopy], new Set([treeCopy.locator]), options);

  if (options.debugLevel >= DebugLevel.PERF)
    console.timeEnd(`hoist`);

  if (options.debugLevel >= DebugLevel.CHECK) {
    const checkLog = selfCheck(treeCopy);
    if (checkLog) {
      throw new Error(`${checkLog}, after hoisting finished:\n${dumpDepTree(treeCopy)}`);
    }
  }

  if (options.debugLevel >= DebugLevel.REASONS)
    console.log(dumpDepTree(treeCopy));

  return shrinkTree(treeCopy);
};

const getHoistedDependencies = (rootNode: HoisterWorkTree): Map<PackageName, HoisterWorkTree> => {
  const hoistedDependencies = new Map();
  const seenNodes = new Set<HoisterWorkTree>();

  const addHoistedDependencies = (node: HoisterWorkTree) => {
    if (seenNodes.has(node))
      return;
    seenNodes.add(node);

    for (const dep of node.hoistedDependencies.values())
      if (!rootNode.dependencies.has(dep.name))
        hoistedDependencies.set(dep.name, dep);

    for (const dep of node.dependencies.values()) {
      if (!node.peerNames.has(dep.name)) {
        addHoistedDependencies(dep);
      }
    }
  };

  addHoistedDependencies(rootNode);

  return hoistedDependencies;
};

/**
 * This method clones the node and returns cloned node copy, if the node was not previously decoupled.
 *
 * The node is considered decoupled if there is no multiple parents to any node
 * on the path from the dependency graph root up to this node. This means that there are no other
 * nodes in dependency graph that somehow transitively use this node and hence node can be hoisted without
 * side effects.
 *
 * The process of node decoupling is done by going from root node of the graph up to the node in concern
 * and decoupling each node on this graph path.
 *
 * @param node original node
 *
 * @returns decoupled node
 */
const decoupleGraphNode = (parent: HoisterWorkTree, node: HoisterWorkTree): HoisterWorkTree => {
  if (node.decoupled)
    return node;

  const {name, references, ident, locator, dependencies, originalDependencies, hoistedDependencies, peerNames, reasons, isHoistBorder} = node;
  // To perform node hoisting from parent node we must clone parent nodes up to the root node,
  // because some other package in the tree might depend on the parent package where hoisting
  // cannot be performed
  const clone = {
    name,
    references: new Set(references),
    ident,
    locator,
    dependencies: new Map(dependencies),
    originalDependencies: new Map(originalDependencies),
    hoistedDependencies: new Map(hoistedDependencies),
    peerNames: new Set(peerNames),
    reasons: new Map(reasons),
    decoupled: true,
    isHoistBorder,
  };
  const selfDep = clone.dependencies.get(name);
  if (selfDep && selfDep.ident == clone.ident)
    // Update self-reference
    clone.dependencies.set(name, clone);

  parent.dependencies.set(clone.name, clone);

  return clone;
};

/**
 * Builds a map of most preferred packages that might be hoisted to the root node.
 *
 * The values in the map are idents sorted by preference from most preferred to less preferred.
 * If the root node has already some version of a package, the value array will contain only
 * one element, since it is not possible for other versions of a package to be hoisted.
 *
 * @param rootNode root node
 * @param preferenceMap preference map
 */
const getHoistIdentMap = (rootNode: HoisterWorkTree, preferenceMap: PreferenceMap): Map<PackageName, Array<Ident>> => {
  const identMap = new Map<PackageName, Array<Ident>>([[rootNode.name, [rootNode.ident]]]);

  for (const dep of rootNode.dependencies.values()) {
    if (!rootNode.peerNames.has(dep.name)) {
      identMap.set(dep.name, [dep.ident]);
    }
  }

  const keyList = Array.from(preferenceMap.keys());
  keyList.sort((key1, key2) => {
    const entry1 = preferenceMap.get(key1)!;
    const entry2 = preferenceMap.get(key2)!;
    if (entry2.peerDependents.size !== entry1.peerDependents.size) {
      return entry2.peerDependents.size - entry1.peerDependents.size;
    } else {
      return entry2.dependents.size - entry1.dependents.size;
    }
  });

  for (const key of keyList) {
    const name = key.substring(0, key.indexOf(`@`, 1));
    const ident = key.substring(name.length + 1);
    if (!rootNode.peerNames.has(name)) {
      let idents = identMap.get(name);
      if (!idents) {
        idents = [];
        identMap.set(name, idents);
      }
      if (idents.indexOf(ident) < 0) {
        idents.push(ident);
      }
    }
  }

  return identMap;
};

/**
 * Gets regular node dependencies only and sorts them in the order so that
 * peer dependencies come before the dependency that rely on them.
 *
 * @param node graph node
 * @returns sorted regular dependencies
 */
const getSortedRegularDependencies = (node: HoisterWorkTree): Set<HoisterWorkTree> => {
  const dependencies: Set<HoisterWorkTree> = new Set();

  const addDep = (dep: HoisterWorkTree, seenDeps = new Set()) => {
    if (seenDeps.has(dep))
      return;
    seenDeps.add(dep);

    for (const peerName of dep.peerNames) {
      if (!node.peerNames.has(peerName)) {
        const peerDep = node.dependencies.get(peerName);
        if (peerDep && !dependencies.has(peerDep)) {
          addDep(peerDep, seenDeps);
        }
      }
    }
    dependencies.add(dep);
  };

  for (const dep of node.dependencies.values()) {
    if (!node.peerNames.has(dep.name)) {
      addDep(dep);
    }
  }

  return dependencies;
};

/**
 * Performs hoisting all the dependencies down the tree to the root node.
 *
 * The algorithm used here reduces dependency graph by deduplicating
 * instances of the packages while keeping:
 * 1. Regular dependency promise: the package should require the exact version of the dependency
 * that was declared in its `package.json`
 * 2. Peer dependency promise: the package and its direct parent package
 * must use the same instance of the peer dependency
 *
 * The regular and peer dependency promises are kept while performing transform
 * on tree branches of packages at a time:
 * `root package` -> `parent package 1` ... `parent package n` -> `dependency`
 * We check wether we can hoist `dependency` to `root package`, this boils down basically
 * to checking:
 * 1. Wether `root package` does not depend on other version of `dependency`
 * 2. Wether all the peer dependencies of a `dependency` had already been hoisted from all `parent packages`
 *
 * If many versions of the `dependency` can be hoisted to the `root package` we choose the most used
 * `dependency` version in the project among them.
 *
 * This function mutates the tree.
 *
 * @param tree package dependencies graph
 * @param rootNode root node to hoist to
 * @param rootNodePath root node path in the tree
 * @param rootNodePathLocators a set of locators for nodes that lead from the top of the tree up to root node
 * @param options hoisting options
 */
const hoistTo = (tree: HoisterWorkTree, rootNodePath: Array<HoisterWorkTree>, rootNodePathLocators: Set<Locator>, options: InternalHoistOptions, seenNodes: Set<HoisterWorkTree> = new Set()) => {
  const rootNode = rootNodePath[rootNodePath.length - 1];
  if (seenNodes.has(rootNode))
    return;
  seenNodes.add(rootNode);

  const preferenceMap = buildPreferenceMap(rootNode);

  const hoistIdentMap = getHoistIdentMap(rootNode, preferenceMap);

  const hoistIdents = new Map(Array.from(hoistIdentMap.entries()).map(([k, v]) => [k, v[0]]));

  const hoistedDependencies = rootNode === tree ? new Map() : getHoistedDependencies(rootNode);

  let wasStateChanged;
  do {
    hoistGraph(tree, rootNodePath, rootNodePathLocators, hoistedDependencies, hoistIdents, hoistIdentMap, options);
    wasStateChanged = false;
    for (const [name, idents] of hoistIdentMap) {
      if (idents.length > 1 && !rootNode.dependencies.has(name)) {
        hoistIdents.delete(name);
        idents.shift();
        hoistIdents.set(name, idents[0]);
        wasStateChanged = true;
      }
    }
  } while (wasStateChanged);

  for (const dependency of rootNode.dependencies.values()) {
    if (!rootNode.peerNames.has(dependency.name) && !rootNodePathLocators.has(dependency.locator)) {
      rootNodePathLocators.add(dependency.locator);
      hoistTo(tree, [...rootNodePath, dependency], rootNodePathLocators, options);
      rootNodePathLocators.delete(dependency.locator);
    }
  }
};

const getNodeHoistInfo = (rootNodePathLocators: Set<Locator>, nodePath: Array<HoisterWorkTree>, node: HoisterWorkTree, hoistedDependencies: Map<PackageName, HoisterWorkTree>, hoistIdents: Map<PackageName, Ident>, hoistIdentMap: Map<Ident, Array<Ident>>, {outputReason}: {outputReason: boolean}): HoistInfo => {
  let reasonRoot;
  let reason: string | null = null;
  let dependsOn: Set<HoisterWorkTree> | null = new Set();
  if (outputReason)
    reasonRoot = `${Array.from(rootNodePathLocators).map(x => prettyPrintLocator(x)).join(`→`)}`;

  const parentNode = nodePath[nodePath.length - 1];
  // We cannot hoist self-references
  const isSelfReference = node.ident === parentNode.ident;
  const hoistedIdent = hoistIdents.get(node.name);
  let isHoistable = hoistedIdent === node.ident && !isSelfReference;
  if (outputReason && !isHoistable && hoistedIdent && !isSelfReference)
    reason = `- filled by: ${prettyPrintLocator(hoistIdentMap.get(node.name)![0])} at ${reasonRoot}`;

  if (isHoistable) {
    let isNameAvailable = false;
    const hoistedDep = hoistedDependencies.get(node.name);
    isNameAvailable = (!hoistedDep || hoistedDep.ident === node.ident);
    if (outputReason && !isNameAvailable)
      reason = `- filled by: ${prettyPrintLocator(hoistedDep!.locator)} at ${reasonRoot}`;
    if (isNameAvailable) {
      for (let idx = 1; idx < nodePath.length - 1; idx++) {
        const parent = nodePath[idx];
        const parentDep = parent.dependencies.get(node.name);
        if (parentDep && parentDep.ident !== node.ident) {
          isNameAvailable = false;
          if (outputReason)
            reason = `- filled by: ${prettyPrintLocator(parentDep!.locator)} at ${prettyPrintLocator(parent.locator)}`;
          break;
        }
      }
    }

    isHoistable = isNameAvailable;
  }

  if (isHoistable) {
    let arePeerDepsSatisfied = true;
    const checkList = new Set(node.peerNames);
    for (let idx = nodePath.length - 1; idx >= 1; idx--) {
      const parent = nodePath[idx];
      for (const name of checkList) {
        if (parent.peerNames.has(name) && parent.originalDependencies.has(name))
          continue;

        const parentDepNode = parent.dependencies.get(name);
        if (parentDepNode) {
          if (idx === nodePath.length - 1) {
            dependsOn!.add(parentDepNode);
          } else {
            dependsOn = null;
            arePeerDepsSatisfied = false;
            if (outputReason) {
              reason = `- peer dependency ${prettyPrintLocator(parentDepNode.locator)} from parent ${prettyPrintLocator(parent.locator)} was not hoisted to ${reasonRoot}`;
            }
          }
        }
        checkList.delete(name);
      }
      if (!arePeerDepsSatisfied) {
        break;
      }
    }
    isHoistable = arePeerDepsSatisfied;
  }

  if (dependsOn !== null && dependsOn.size > 0) {
    return {isHoistable: Hoistable.DEPENDS, dependsOn, reason};
  } else {
    return {isHoistable: isHoistable ? Hoistable.YES : Hoistable.NO, reason};
  }
};

/**
 * Performs actual graph transformation, by hoisting packages to the root node.
 *
 * @param tree dependency tree
 * @param rootNodePath root node path in the tree
 * @param rootNodePathLocators a set of locators for nodes that lead from the top of the tree up to root node
 * @param hoistedDependencies map of dependencies that were hoisted to parent nodes
 * @param hoistIdents idents that should be attempted to be hoisted to the root node
 */
const hoistGraph = (tree: HoisterWorkTree, rootNodePath: Array<HoisterWorkTree>, rootNodePathLocators: Set<Locator>, hoistedDependencies: Map<PackageName, HoisterWorkTree>, hoistIdents: Map<PackageName, Ident>, hoistIdentMap: Map<Ident, Array<Ident>>, options: InternalHoistOptions) => {
  const rootNode = rootNodePath[rootNodePath.length - 1];
  const seenNodes = new Set<HoisterWorkTree>();

  const hoistNodeDependencies = (nodePath: Array<HoisterWorkTree>, locatorPath: Array<Locator>, parentNode: HoisterWorkTree, newNodes: Set<HoisterWorkTree>) => {
    if (seenNodes.has(parentNode))
      return;

    const nextLocatorPath = [...locatorPath, parentNode.locator];

    const dependantTree = new Map<PackageName, Set<PackageName>>();
    const hoistInfos = new Map<HoisterWorkTree, HoistInfo>();
    for (const subDependency of getSortedRegularDependencies(parentNode)) {
      let hoistInfo: HoistInfo | null = null;

      if (!hoistInfo)
        hoistInfo = getNodeHoistInfo(rootNodePathLocators, [rootNode, ...nodePath, parentNode], subDependency, hoistedDependencies, hoistIdents, hoistIdentMap, {outputReason: options.debugLevel >= DebugLevel.REASONS});

      hoistInfos.set(subDependency, hoistInfo);
      if (hoistInfo.isHoistable === Hoistable.DEPENDS) {
        for (const node of hoistInfo.dependsOn) {
          const nodeDependants = dependantTree.get(node.name) || new Set();
          nodeDependants.add(subDependency.name);
          dependantTree.set(node.name, nodeDependants);
        }
      }
    }

    const unhoistableNodes = new Set<HoisterWorkTree>();
    const addUnhoistableNode = (node: HoisterWorkTree, hoistInfo: HoistInfo, reason: string) => {
      if (!unhoistableNodes.has(node)) {
        unhoistableNodes.add(node);
        if (node.ident !== parentNode.ident)
          hoistInfos.set(node, {isHoistable: Hoistable.NO, reason});
        for (const dependantName of dependantTree.get(node.name) || []) {
          addUnhoistableNode(parentNode.dependencies.get(dependantName)!, hoistInfo, reason);
        }
      }
    };

    let reasonRoot;
    if (options.debugLevel >= DebugLevel.REASONS)
      reasonRoot = `${Array.from(rootNodePathLocators).map(x => prettyPrintLocator(x)).join(`→`)}`;

    for (const [node, hoistInfo] of hoistInfos)
      if (hoistInfo.isHoistable === Hoistable.NO)
        addUnhoistableNode(node, hoistInfo, `- peer dependency ${prettyPrintLocator(node.locator)} from parent ${prettyPrintLocator(parentNode.locator)} was not hoisted to ${reasonRoot}`);

    for (const node of hoistInfos.keys()) {
      if (!unhoistableNodes.has(node)) {
        parentNode.dependencies.delete(node.name);
        parentNode.hoistedDependencies.set(node.name, node);
        parentNode.reasons.delete(node.name);
        const hoistedNode = rootNode.dependencies.get(node.name);
        // Add hoisted node to root node, in case it is not already there
        if (!hoistedNode) {
          // Avoid adding other version of root node to itself
          if (rootNode.ident !== node.ident) {
            rootNode.dependencies.set(node.name, node);
            newNodes.add(node);
          }
        } else {
          for (const reference of node.references) {
            hoistedNode.references.add(reference);
          }
        }
      }
    }

    if (options.check) {
      const checkLog = selfCheck(tree);
      if (checkLog) {
        throw new Error(`${checkLog}, after hoisting dependencies of ${[rootNode, ...nodePath, parentNode].map(x => prettyPrintLocator(x.locator)).join(`→`)}:\n${dumpDepTree(tree)}`);
      }
    }

    const children = getSortedRegularDependencies(parentNode);
    for (const node of children) {
      if (unhoistableNodes.has(node) && nextLocatorPath.indexOf(node.locator) < 0) {
        const hoistInfo = hoistInfos.get(node)!;
        if (hoistInfo.isHoistable !== Hoistable.YES)
          parentNode.reasons.set(node.name, hoistInfo.reason!);

        if (!node.isHoistBorder) {
          seenNodes.add(parentNode);
          const decoupledNode = decoupleGraphNode(parentNode, node);

          hoistNodeDependencies([...nodePath, parentNode], [...locatorPath, parentNode.locator], decoupledNode, nextNewNodes);

          seenNodes.delete(parentNode);
        }
      }
    }
  };

  let newNodes;
  let nextNewNodes = new Set(getSortedRegularDependencies(rootNode));
  do {
    newNodes = nextNewNodes;
    nextNewNodes = new Set();
    for (const dep of newNodes) {
      if (dep.locator === rootNode.locator || dep.isHoistBorder)
        continue;
      const decoupledDependency = decoupleGraphNode(rootNode, dep);

      hoistNodeDependencies([], Array.from(rootNodePathLocators), decoupledDependency, nextNewNodes);
    }
  } while (nextNewNodes.size > 0);
};

const selfCheck = (tree: HoisterWorkTree): string => {
  const log: Array<string> = [];

  const seenNodes = new Set();
  const parents = new Set<HoisterWorkTree>();

  const checkNode = (node: HoisterWorkTree, parentDeps: Map<PackageName, HoisterWorkTree>) => {
    if (seenNodes.has(node))
      return;
    seenNodes.add(node);

    if (parents.has(node))
      return;

    const dependencies = new Map(parentDeps);
    for (const dep of node.dependencies.values())
      if (!node.peerNames.has(dep.name))
        dependencies.set(dep.name, dep);

    for (const origDep of node.originalDependencies.values()) {
      const dep = dependencies.get(origDep.name);
      const prettyPrintTreePath = () => `${Array.from(parents).concat([node]).map(x => prettyPrintLocator(x.locator)).join(`→`)}`;
      if (node.peerNames.has(origDep.name)) {
        const parentDep = parentDeps.get(origDep.name);
        if (parentDep !== dep || !parentDep || parentDep.ident !== origDep.ident) {
          log.push(`${prettyPrintTreePath()} - broken peer promise: expected ${origDep!.ident} but found ${parentDep ? parentDep.ident : parentDep}`);
        }
      } else {
        if (!dep) {
          log.push(`${prettyPrintTreePath()} - broken require promise: no required dependency ${origDep.locator} found`);
        } else if (dep.ident !== origDep.ident) {
          log.push(`${prettyPrintTreePath()} - broken require promise for ${origDep.name}: expected ${origDep.ident}, but found: ${dep.ident}`);
        }
      }
    }

    parents.add(node);
    for (const dep of node.dependencies.values()) {
      if (!node.peerNames.has(dep.name)) {
        checkNode(dep, dependencies);
      }
    }
    parents.delete(node);
  };

  checkNode(tree, tree.dependencies);

  return log.join(`\n`);
};

/**
 * Creates a clone of package tree with extra fields used for hoisting purposes.
 *
 * @param tree package tree clone
 */
const cloneTree = (tree: HoisterTree, options: InternalHoistOptions): HoisterWorkTree => {
  const {identName, name, reference, peerNames} = tree;
  const treeCopy: HoisterWorkTree = {
    name,
    references: new Set([reference]),
    locator: makeLocator(identName, reference),
    ident: makeIdent(identName, reference),
    dependencies: new Map(),
    originalDependencies: new Map(),
    hoistedDependencies: new Map(),
    peerNames: new Set(peerNames),
    reasons: new Map(),
    decoupled: true,
    isHoistBorder: true,
  };

  const seenNodes = new Map<HoisterTree, HoisterWorkTree>([[tree, treeCopy]]);

  const addNode = (node: HoisterTree, parentNode: HoisterWorkTree) => {
    let workNode = seenNodes.get(node);
    const isSeen = !!workNode;
    if (!workNode) {
      const {name, identName, reference, peerNames} = node;
      const dependenciesNmHoistingLimits = options.hoistingLimits.get(parentNode.locator);
      workNode = {
        name,
        references: new Set([reference]),
        locator: makeLocator(identName, reference),
        ident: makeIdent(identName, reference),
        dependencies: new Map(),
        originalDependencies: new Map(),
        hoistedDependencies: new Map(),
        peerNames: new Set(peerNames),
        reasons: new Map(),
        decoupled: true,
        isHoistBorder: dependenciesNmHoistingLimits ? dependenciesNmHoistingLimits.has(name) : false,
      };
      seenNodes.set(node, workNode);
    }

    parentNode.dependencies.set(node.name, workNode);
    parentNode.originalDependencies.set(node.name, workNode);

    if (!isSeen) {
      for (const dep of node.dependencies) {
        addNode(dep, workNode);
      }
    } else {
      const seenCoupledNodes = new Set();

      const markNodeCoupled = (node: HoisterWorkTree) => {
        if (seenCoupledNodes.has(node))
          return;
        seenCoupledNodes.add(node);
        node.decoupled = false;

        for (const dep of node.dependencies.values()) {
          if (!node.peerNames.has(dep.name)) {
            markNodeCoupled(dep);
          }
        }
      };

      markNodeCoupled(workNode);
    }
  };

  for (const dep of tree.dependencies)
    addNode(dep, treeCopy);

  return treeCopy;
};

const getIdentName = (locator: Locator) => locator.substring(0, locator.indexOf(`@`, 1));

/**
 * Creates a clone of hoisted package tree with extra fields removed
 *
 * @param tree stripped down hoisted package tree clone
 */
const shrinkTree = (tree: HoisterWorkTree): HoisterResult => {
  const treeCopy: HoisterResult = {
    name: tree.name,
    identName: getIdentName(tree.locator),
    references: new Set(tree.references),
    dependencies: new Set(),
  };

  const seenNodes = new Set<HoisterWorkTree>([tree]);

  const addNode = (node: HoisterWorkTree, parentWorkNode: HoisterWorkTree, parentNode: HoisterResult) => {
    const isSeen = seenNodes.has(node);

    let resultNode: HoisterResult;
    if (parentWorkNode === node) {
      resultNode = parentNode;
    } else {
      const {name, references, locator} = node;
      resultNode = {
        name,
        identName: getIdentName(locator),
        references,
        dependencies: new Set<HoisterResult>(),
      };
    }
    parentNode.dependencies.add(resultNode);

    if (!isSeen) {
      seenNodes.add(node);
      for (const dep of node.dependencies.values()) {
        if (!node.peerNames.has(dep.name)) {
          addNode(dep, node, resultNode);
        }
      }
      seenNodes.delete(node);
    }
  };

  for (const dep of tree.dependencies.values())
    addNode(dep, tree, treeCopy);

  return treeCopy;
};

/**
 * Builds mapping, where key is an alias + dependent package ident and the value is the list of
 * parent package idents who depend on this package.
 *
 * @param rootNode package tree root node
 *
 * @returns preference map
 */
const buildPreferenceMap = (rootNode: HoisterWorkTree): PreferenceMap => {
  const preferenceMap: PreferenceMap = new Map();

  const seenNodes = new Set<HoisterWorkTree>([rootNode]);
  const getPreferenceKey = (node: HoisterWorkTree) => `${node.name}@${node.ident}`;

  const getOrCreatePreferenceEntry = (node: HoisterWorkTree) => {
    const key = getPreferenceKey(node);
    let entry = preferenceMap.get(key);
    if (!entry) {
      entry = {dependents: new Set<Ident>(), peerDependents: new Set<Ident>()};
      preferenceMap.set(key, entry);
    }
    return entry;
  };

  const addDependent = (dependent: HoisterWorkTree, node: HoisterWorkTree) => {
    const isSeen = !!seenNodes.has(node);

    const entry = getOrCreatePreferenceEntry(node);
    entry.dependents.add(dependent.ident);

    if (!isSeen) {
      seenNodes.add(node);
      for (const dep of node.dependencies.values()) {
        if (node.peerNames.has(dep.name)) {
          const entry = getOrCreatePreferenceEntry(dep);
          entry.peerDependents.add(node.ident);
        } else {
          addDependent(node, dep);
        }
      }
    }
  };

  for (const dep of rootNode.dependencies.values())
    if (!rootNode.peerNames.has(dep.name))
      addDependent(rootNode, dep);

  return preferenceMap;
};

const prettyPrintLocator = (locator: Locator) => {
  const idx = locator.indexOf(`@`, 1);
  const name = locator.substring(0, idx);
  const reference = locator.substring(idx + 1);
  if (reference === `workspace:.`) {
    return `.`;
  } else if (!reference) {
    return `${name}`;
  } else {
    const version = (reference.indexOf(`#`) > 0 ? reference.split(`#`)[1] : reference).replace(`npm:`, ``);
    if (reference.startsWith(`virtual`)) {
      return `v:${name}@${version}`;
    } else {
      return `${name}@${version}`;
    }
  }
};

const MAX_NODES_TO_DUMP = 50000;

/**
 * Pretty-prints dependency tree in the `yarn why`-like format
 *
 * The function is used for troubleshooting purposes only.
 *
 * @param pkg node_modules tree
 *
 * @returns sorted node_modules tree
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const dumpDepTree = (tree: HoisterWorkTree) => {
  let nodeCount = 0;
  const dumpPackage = (pkg: HoisterWorkTree, parents: Set<HoisterWorkTree>, prefix = ``): string => {
    if (nodeCount > MAX_NODES_TO_DUMP || parents.has(pkg))
      return ``;

    nodeCount++;
    const dependencies = Array.from(pkg.dependencies.values());

    let str = ``;
    parents.add(pkg);
    for (let idx = 0; idx < dependencies.length; idx++) {
      const dep = dependencies[idx];
      if (!pkg.peerNames.has(dep.name)) {
        const reason = pkg.reasons.get(dep.name);
        const identName = getIdentName(dep.locator);
        str += `${prefix}${idx < dependencies.length - 1 ? `├─` : `└─`}${(parents.has(dep) ? `>` : ``) + (identName !== dep.name ? `a:${dep.name}:` : ``) + prettyPrintLocator(dep.locator) + (reason ? ` ${reason}`: ``)}\n`;
        str += dumpPackage(dep, parents, `${prefix}${idx < dependencies.length - 1 ?`│ ` : `  `}`);
      }
    }
    parents.delete(pkg);
    return str;
  };

  const treeDump = dumpPackage(tree, new Set());

  return treeDump + ((nodeCount > MAX_NODES_TO_DUMP) ? `\nTree is too large, part of the tree has been dunped\n` : ``);
};
