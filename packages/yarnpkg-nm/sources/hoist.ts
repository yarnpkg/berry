import {miscUtils} from '@yarnpkg/core';

/**
 * High-level node_modules hoisting algorithm recipe
 *
 * 1. Take input dependency graph and start traversing it,
 * as you visit new node in the graph - clone it if there can be multiple paths
 * to access the node from the graph root to the node, e.g. essentially represent
 * the graph with a tree as you go, to make hoisting possible.
 *
 * 2. You want to hoist every node possible to the top root node first,
 * then to each of its children etc, so you need to keep track what is your current
 * root node into which you are hoisting
 *
 * 3. Traverse the dependency graph from the current root node and for each package name
 * that can be potentially hoisted to the current root node build a list of idents
 * in descending hoisting preference. You will check in next steps whether most preferred ident
 * for the given package name can be hoisted first, and if not, then you check the
 * less preferred ident, etc, until either some ident will be hoisted
 * or you run out of idents to check
 * (no need to convert the graph to the tree when you build this preference map).
 *
 * 4. The children of the root node are already "hoisted", so you need to start
 * from the dependencies of these children. You take some child and
 * sort its dependencies so that regular dependencies without peer dependencies
 * will come first and then those dependencies that peer depend on them.
 * This is needed to make algorithm more efficient and hoist nodes which are easier
 * to hoist first and then handle peer dependent nodes.
 *
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
 *
 * 6. When you have hoistable answer for each dependency of a node you then build
 * a list of nodes that are NOT hoistable. These are the nodes that have answer NO
 * and the nodes that DEPENDS on these nodes. All the other nodes are hoistable,
 * those that have answer YES and those that have answer DEPENDS,
 * because they are cyclically dependent on each another
 *
 * 7. You hoist all the hoistable nodes to the current root and continue traversing
 * the tree. Note, you need to track newly added nodes to the current root,
 * because after you finished tree traversal you want to come back to these new nodes
 * first thing and hoist everything from each of them to the current tree root.
 *
 * 8. After you have finished traversing newly hoisted current root nodes
 * it means you cannot hoist anything to the current tree root and you need to pick
 * the next node as current tree root and run the algorithm again
 * until you run out of candidates for current tree root.
 */
type HoisterName = string;

export enum HoisterDependencyKind {
  REGULAR,
  WORKSPACE,
  EXTERNAL_SOFT_LINK,
}

export type HoisterNode = {
  id: number;
  name: HoisterName;
  identName: HoisterName;
  reference: string;
  dependencies: Set<number>;
  peerNames: Set<HoisterName>;
  hoistPriority?: number;
  dependencyKind?: HoisterDependencyKind;
};

export type HoisterTree = {
  nodes: Array<HoisterNode>;
  root: number;
};

export type HoisterResult = {
  name: HoisterName;
  identName: HoisterName;
  references: Set<string>;
  dependencies: Set<HoisterResult>;
};

type HoisterLocator = string;
type AliasedLocator = string & {__aliasedLocator: true};
type HoisterIdent = string;

type HoisterWorkNode = {
  id: number;
  name: HoisterName;
  references: Set<string>;
  ident: HoisterIdent;
  locator: HoisterLocator;
  dependencies: Map<HoisterName, number>;
  originalDependencies: Map<HoisterName, number>;
  hoistedDependencies: Map<HoisterName, number>;
  peerNames: ReadonlySet<HoisterName>;
  decoupled: boolean;
  reasons: Map<HoisterName, string>;
  isHoistBorder: boolean;
  hoistedFrom: Map<HoisterName, Array<string>>;
  hoistedTo: Map<HoisterName, string>;
  hoistPriority: number;
  dependencyKind: HoisterDependencyKind;
};

type HoisterWorkTree = {
  nodes: Array<HoisterWorkNode>;
  root: number;
};

/**
 * Mapping which packages depend on a given package alias + ident. It is used to determine hoisting weight,
 * e.g. which one among the group of packages with the same name should be hoisted.
 * The package having the biggest number of parents using this package will be hoisted.
 */
type PreferenceMap = Map<string, {
  peerDependents: Set<HoisterIdent>;
  dependents: Set<HoisterIdent>;
  hoistPriority: number;
}>;

enum Hoistable {
  YES,
  NO,
  DEPENDS,
}

type HoistInfo = {
  isHoistable: Hoistable.YES;
} | {
  isHoistable: Hoistable.NO;
  reason: string | null;
} | {
  isHoistable: Hoistable.DEPENDS;
  dependsOn: Set<number>;
  reason: string | null;
};

type ShadowedNodes = Map<number, Set<HoisterName>>;

const makeLocator = (name: string, reference: string) => {
  return `${name}@${reference}`;
};

const makeIdent = (name: string, reference: string) => {
  const hashIdx = reference.indexOf(`#`);

  // Strip virtual reference part, we don't need it for hoisting purposes
  const realReference = hashIdx >= 0
    ? reference.substring(hashIdx + 1)
    : reference!;

  return makeLocator(name, realReference);
};

enum DebugLevel {
  NONE = -1,
  PERF = 0,
  CHECK = 1,
  REASONS = 2,
  INTENSIVE_CHECK = 9,
}

export type HoistOptions = {
  /** Runs self-checks after hoisting is finished */
  check?: boolean;
  /** Debug level */
  debugLevel?: DebugLevel;
  /** Hoist borders are defined by parent node locator and its dependency name. The dependency is considered a border, nothing can be hoisted past this dependency, but dependency can be hoisted */
  hoistingLimits?: Map<HoisterLocator, Set<HoisterName>>;
};

type InternalHoistOptions = {
  check?: boolean;
  debugLevel: DebugLevel;
  fastLookupPossible: boolean;
  hoistingLimits: Map<HoisterLocator, Set<HoisterName>>;
};

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

  const options: InternalHoistOptions = {
    check,
    debugLevel,
    hoistingLimits,
    fastLookupPossible: true,
  };

  let startTime: number;
  if (options.debugLevel >= DebugLevel.PERF)
    startTime = Date.now();

  const treeCopy = cloneTree(tree, options);

  let round = 0;
  let anotherRoundNeeded = true;

  while (anotherRoundNeeded) {
    const rootWorkNode = treeCopy.nodes[treeCopy.root];
    const result = hoistTo(treeCopy, [treeCopy.root], new Set([rootWorkNode.locator]), new Map(), options);

    anotherRoundNeeded = result.anotherRoundNeeded || result.isGraphChanged;
    options.fastLookupPossible = false;

    round++;
  }

  if (options.debugLevel >= DebugLevel.PERF)
    console.log(`hoist time: ${Date.now() - startTime!}ms, rounds: ${round}`);

  if (options.debugLevel >= DebugLevel.CHECK) {
    const prevTreeDump = dumpDepTree(treeCopy);

    const isGraphChanged = hoistTo(treeCopy, [treeCopy.root], new Set([treeCopy.nodes[treeCopy.root].locator]), new Map(), options).isGraphChanged;
    if (isGraphChanged)
      throw new Error(`The hoisting result is not terminal, prev tree:\n${prevTreeDump}, next tree:\n${dumpDepTree(treeCopy)}`);

    const checkLog = selfCheck(treeCopy);
    if (checkLog) {
      throw new Error(`${checkLog}, after hoisting finished:\n${dumpDepTree(treeCopy)}`);
    }
  }

  if (options.debugLevel >= DebugLevel.REASONS)
    console.log(dumpDepTree(treeCopy));

  return shrinkTree(treeCopy);
};

const getZeroRoundUsedDependencies = (tree: HoisterWorkTree, rootNodePath: Array<number>): Map<HoisterName, number> => {
  const rootNode = rootNodePath[rootNodePath.length - 1];
  const usedDependencies = new Map();
  const seenNodes = new Set<number>();

  const addUsedDependencies = (nodeId: number) => {
    if (seenNodes.has(nodeId))
      return;

    seenNodes.add(nodeId);

    const node = tree.nodes[nodeId];

    for (const depId of node.hoistedDependencies.values())
      usedDependencies.set(tree.nodes[depId].name, depId);

    for (const depId of node.dependencies.values()) {
      const dep = tree.nodes[depId];
      if (!node.peerNames.has(dep.name)) {
        addUsedDependencies(depId);
      }
    }
  };

  addUsedDependencies(rootNode);

  return usedDependencies;
};

const getUsedDependencies = (tree: HoisterWorkTree, rootNodePath: Array<number>): Map<HoisterName, number> => {
  const rootNodeId = rootNodePath[rootNodePath.length - 1];
  const usedDependencies = new Map<HoisterName, number>();
  const seenNodes = new Set<number>();

  const hiddenDependencies = new Set<HoisterName>();

  const addUsedDependencies = (nodeId: number, hiddenDependencies: Set<HoisterName>) => {
    if (seenNodes.has(nodeId))
      return;

    seenNodes.add(nodeId);

    const node = tree.nodes[nodeId];

    for (const depId of node.hoistedDependencies.values()) {
      const dep = tree.nodes[depId];
      if (hiddenDependencies.has(dep.name))
        continue;

      for (const nodeId of rootNodePath) {
        const node = tree.nodes[nodeId];
        const reachableDependencyId = node.dependencies.get(dep.name);
        if (typeof reachableDependencyId !== `undefined`) {
          const reachableDependency = tree.nodes[reachableDependencyId];
          usedDependencies.set(reachableDependency.name, reachableDependencyId);
        }
      }
    }

    const childrenHiddenDependencies = new Set<HoisterName>();
    for (const depId of node.dependencies.values()) {
      const dep = tree.nodes[depId];
      childrenHiddenDependencies.add(dep.name);
    }

    for (const depId of node.dependencies.values()) {
      const dep = tree.nodes[depId];
      if (!node.peerNames.has(dep.name)) {
        addUsedDependencies(depId, childrenHiddenDependencies);
      }
    }
  };

  addUsedDependencies(rootNodeId, hiddenDependencies);

  return usedDependencies;
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
const decoupleGraphNode = (tree: HoisterWorkTree, parentId: number, nodeId: number): number => {
  const node = tree.nodes[nodeId];
  if (node.decoupled)
    return nodeId;

  const {
    name,
    references,
    ident,
    locator,
    dependencies,
    originalDependencies,
    hoistedDependencies,
    peerNames,
    reasons,
    isHoistBorder,
    hoistPriority,
    dependencyKind,
    hoistedFrom,
    hoistedTo,
  } = node;

  // To perform node hoisting from parent node we must clone parent nodes up to the root node,
  // because some other package in the tree might depend on the parent package where hoisting
  // cannot be performed
  const clone: HoisterWorkNode = {
    id: tree.nodes.length,
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
    hoistPriority,
    dependencyKind,
    hoistedFrom: new Map(hoistedFrom),
    hoistedTo: new Map(hoistedTo),
  };

  tree.nodes.push(clone);

  // Update self-reference
  const selfDepId = clone.dependencies.get(name);
  if (typeof selfDepId !== `undefined`) {
    const selfDep = tree.nodes[selfDepId];
    if (selfDep.ident === clone.ident) {
      clone.dependencies.set(name, clone.id);
    }
  }

  const parent = tree.nodes[parentId];
  parent.dependencies.set(clone.name, clone.id);

  return clone.id;
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
const getHoistIdentMap = (tree: HoisterWorkTree, rootNodeId: number, preferenceMap: PreferenceMap): Map<HoisterName, Array<HoisterIdent>> => {
  const rootNode = tree.nodes[rootNodeId];

  const identMap = new Map<HoisterName, Array<HoisterIdent>>([
    [rootNode.name, [rootNode.ident]],
  ]);

  for (const depId of rootNode.dependencies.values()) {
    const dep = tree.nodes[depId];
    if (!rootNode.peerNames.has(dep.name)) {
      identMap.set(dep.name, [dep.ident]);
    }
  }

  const keyList = Array.from(preferenceMap.keys());

  keyList.sort((key1, key2) => {
    const entry1 = preferenceMap.get(key1)!;
    const entry2 = preferenceMap.get(key2)!;

    if (entry2.hoistPriority !== entry1.hoistPriority)
      return entry2.hoistPriority - entry1.hoistPriority;

    const entry1Usages = entry1.dependents.size + entry1.peerDependents.size;
    const entry2Usages = entry2.dependents.size + entry2.peerDependents.size;

    return entry2Usages - entry1Usages;
  });

  for (const key of keyList) {
    const name = key.substring(0, key.indexOf(`@`, 1));
    const ident = key.substring(name.length + 1);

    if (rootNode.peerNames.has(name))
      continue;

    const idents = miscUtils.getArrayWithDefault(identMap, name);
    if (!idents.includes(ident)) {
      idents.push(ident);
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
const getSortedRegularDependencies = (tree: HoisterWorkTree, nodeId: number): Set<number> => {
  const node = tree.nodes[nodeId];
  const dependencies: Set<number> = new Set();

  const addDep = (depId: number, seenDeps = new Set()) => {
    if (seenDeps.has(depId))
      return;

    seenDeps.add(depId);

    const dep = tree.nodes[depId];

    for (const peerName of dep.peerNames) {
      if (node.peerNames.has(peerName))
        continue;

      const peerDep = node.dependencies.get(peerName);
      if (peerDep && !dependencies.has(peerDep)) {
        addDep(peerDep, seenDeps);
      }
    }

    dependencies.add(depId);
  };

  for (const depId of node.dependencies.values()) {
    const dep = tree.nodes[depId];
    if (!node.peerNames.has(dep.name)) {
      addDep(depId);
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
const hoistTo = (tree: HoisterWorkTree, rootNodePath: Array<number>, rootNodePathLocators: Set<HoisterLocator>, parentShadowedNodes: ShadowedNodes, options: InternalHoistOptions, seenNodes: Set<number> = new Set()): {anotherRoundNeeded: boolean, isGraphChanged: boolean} => {
  const rootNodeId = rootNodePath[rootNodePath.length - 1];
  const rootNode = tree.nodes[rootNodeId];

  if (seenNodes.has(rootNodeId))
    return {anotherRoundNeeded: false, isGraphChanged: false};

  seenNodes.add(rootNodeId);

  const preferenceMap = buildPreferenceMap(tree, rootNodeId);
  const hoistIdentMap = getHoistIdentMap(tree, rootNodeId, preferenceMap);

  const usedDependencyIds = tree.root === rootNodeId
    ? new Map<HoisterName, number>()
    : options.fastLookupPossible
      ? getZeroRoundUsedDependencies(tree, rootNodePath)
      : getUsedDependencies(tree, rootNodePath);

  let anotherRoundNeeded = false;
  let isGraphChanged = false;

  const hoistIdents = new Map(Array.from(hoistIdentMap.entries()).map(([k, v]) => [k, v[0]]));
  const shadowedNodes: ShadowedNodes = new Map();

  let wasStateChanged = true;
  while (wasStateChanged) {
    const result = hoistGraph(tree, rootNodePath, rootNodePathLocators, usedDependencyIds, hoistIdents, hoistIdentMap, parentShadowedNodes, shadowedNodes, options);

    if (result.isGraphChanged)
      isGraphChanged = true;
    if (result.anotherRoundNeeded)
      anotherRoundNeeded = true;

    wasStateChanged = false;

    for (const [name, idents] of hoistIdentMap) {
      if (idents.length > 1 && !rootNode.dependencies.has(name)) {
        hoistIdents.delete(name);
        idents.shift();
        hoistIdents.set(name, idents[0]);

        wasStateChanged = true;
      }
    }
  }

  for (const dependencyId of rootNode.dependencies.values()) {
    const dependency = tree.nodes[dependencyId];

    if (rootNode.peerNames.has(dependency.name))
      continue;
    if (rootNodePathLocators.has(dependency.locator))
      continue;

    rootNodePathLocators.add(dependency.locator);

    const result = hoistTo(tree, [...rootNodePath, dependencyId], rootNodePathLocators, shadowedNodes, options);

    if (result.isGraphChanged)
      isGraphChanged = true;
    if (result.anotherRoundNeeded)
      anotherRoundNeeded = true;

    rootNodePathLocators.delete(dependency.locator);
  }

  return {
    anotherRoundNeeded,
    isGraphChanged,
  };
};

const hasUnhoistedDependencies = (tree: HoisterWorkTree, nodeId: number): boolean => {
  const node = tree.nodes[nodeId];

  for (const [subName, subDependencyId] of node.dependencies) {
    if (node.peerNames.has(subName))
      continue;

    const subDependency = tree.nodes[subDependencyId];

    if (subDependency.ident !== node.ident) {
      return true;
    }
  }

  return false;
};

const getNodeHoistInfo = (tree:  HoisterWorkTree, rootNodeId: number, rootNodePathLocators: Set<HoisterLocator>, nodePath: Array<number>, nodeId: number, usedDependencyIds: Map<HoisterName, number>, hoistIdents: Map<HoisterName, HoisterIdent>, hoistIdentMap: Map<HoisterIdent, Array<HoisterIdent>>, shadowedNodes: ShadowedNodes, {outputReason, fastLookupPossible}: {outputReason: boolean, fastLookupPossible: boolean}): HoistInfo => {
  let reason: string | null = null;
  let dependsOn: Set<number> | null = new Set();

  const reasonRoot = outputReason
    ? `${Array.from(rootNodePathLocators).map(x => prettyPrintLocator(x)).join(`→`)}`
    : undefined;

  const node = tree.nodes[nodeId];

  const parentNodeId = nodePath[nodePath.length - 1];
  const parentNode = tree.nodes[parentNodeId];

  // We cannot hoist self-references
  const isSelfReference = node.ident === parentNode.ident;

  let isHoistable = true;
  if (isHoistable) {
    isHoistable = !isSelfReference;
    if (outputReason && !isHoistable) {
      reason = `- self-reference`;
    }
  }

  if (isHoistable) {
    isHoistable = node.dependencyKind !== HoisterDependencyKind.WORKSPACE;
    if (outputReason && !isHoistable) {
      reason = `- workspace`;
    }
  }

  if (isHoistable && node.dependencyKind === HoisterDependencyKind.EXTERNAL_SOFT_LINK) {
    isHoistable = !hasUnhoistedDependencies(tree, nodeId);
    if (outputReason && !isHoistable) {
      reason = `- external soft link with unhoisted dependencies`;
    }
  }

  const rootNode = tree.nodes[rootNodeId];

  if (isHoistable) {
    isHoistable = !rootNode.peerNames.has(node.name);
    if (outputReason && !isHoistable) {
      const originalDependencyId = rootNode.originalDependencies.get(node.name);
      if (typeof originalDependencyId === `undefined`)
        throw new Error(`Assertion failed: Expected the original dependency ID to be set`);

      const originalDependency = tree.nodes[originalDependencyId];

      reason = `- cannot shadow peer: ${prettyPrintLocator(originalDependency.locator)} at ${reasonRoot}`;
    }
  }

  if (isHoistable) {
    const usedDepId = usedDependencyIds.get(node.name);

    const usedDep = typeof usedDepId !== `undefined`
      ? tree.nodes[usedDepId]
      : null;

    let isNameAvailable = (!usedDep || usedDep.ident === node.ident);
    if (outputReason && !isNameAvailable)
      reason = `- filled by: ${prettyPrintLocator(usedDep!.locator)} at ${reasonRoot}`;

    if (isNameAvailable) {
      for (let idx = nodePath.length - 1; idx >= 1; idx--) {
        const parentId = nodePath[idx];
        const parent = tree.nodes[parentId];

        const parentDepId = parent.dependencies.get(node.name);
        if (typeof parentDepId === `undefined`)
          continue;

        const parentDep = tree.nodes[parentDepId];
        if (parentDep.ident === node.ident)
          continue;

        isNameAvailable = false;

        const shadowedNames = miscUtils.getSetWithDefault(shadowedNodes, parentNodeId);
        shadowedNames.add(node.name);

        if (outputReason)
          reason = `- filled by ${prettyPrintLocator(parentDep!.locator)} at ${nodePath.slice(0, idx).map(id => prettyPrintLocator(tree.nodes[id].locator)).join(`→`)}`;

        break;
      }
    }

    isHoistable = isNameAvailable;
  }

  if (isHoistable) {
    const hoistedIdent = hoistIdents.get(node.name);
    isHoistable = hoistedIdent === node.ident;

    if (outputReason && !isHoistable) {
      reason = `- filled by: ${prettyPrintLocator(hoistIdentMap.get(node.name)![0])} at ${reasonRoot}`;
    }
  }

  if (isHoistable) {
    let arePeerDepsSatisfied = true;

    const checkList = new Set(node.peerNames);
    for (let idx = nodePath.length - 1; idx >= 1; idx--) {
      const parentId = nodePath[idx];
      const parent = tree.nodes[parentId];

      for (const name of checkList) {
        if (parent.peerNames.has(name) && parent.originalDependencies.has(name))
          continue;

        const parentDepNodeId = parent.dependencies.get(name);
        if (typeof parentDepNodeId !== `undefined`) {
          const parentDepNode = tree.nodes[parentDepNodeId];
          if (rootNode.dependencies.get(name) !== parentDepNodeId) {
            if (idx === nodePath.length - 1) {
              dependsOn!.add(parentDepNodeId);
            } else {
              dependsOn = null;
              arePeerDepsSatisfied = false;

              if (outputReason) {
                reason = `- peer dependency ${prettyPrintLocator(parentDepNode.locator)} from parent ${prettyPrintLocator(parent.locator)} was not hoisted to ${reasonRoot}`;
              }
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

  if (isHoistable && !fastLookupPossible) {
    for (const origDepId of node.hoistedDependencies.values()) {
      const origDep = tree.nodes[origDepId];

      const usedDepId = usedDependencyIds.get(origDep.name) ?? rootNode.dependencies.get(origDep.name);
      if (typeof usedDepId === `undefined`)
        continue;

      const usedDep = tree.nodes[usedDepId];
      if (origDep.ident === usedDep.ident)
        continue;

      isHoistable = false;

      if (outputReason)
        reason = `- previously hoisted dependency mismatch, needed: ${prettyPrintLocator(origDep.locator)}, available: ${prettyPrintLocator(usedDep?.locator)}`;

      break;
    }
  }

  if (dependsOn !== null && dependsOn.size > 0) {
    return {isHoistable: Hoistable.DEPENDS, dependsOn, reason};
  } else {
    return {isHoistable: isHoistable ? Hoistable.YES : Hoistable.NO, reason};
  }
};

const getAliasedLocator = (node: HoisterWorkNode): AliasedLocator => `${node.name}@${node.locator}` as AliasedLocator;

/**
 * Performs actual graph transformation, by hoisting packages to the root node.
 *
 * @param tree dependency tree
 * @param rootNodePath root node path in the tree
 * @param rootNodePathLocators a set of locators for nodes that lead from the top of the tree up to root node
 * @param usedDependencies map of dependency nodes from parents of root node used by root node and its children via parent lookup
 * @param hoistIdents idents that should be attempted to be hoisted to the root node
 */
const hoistGraph = (tree: HoisterWorkTree, rootNodePath: Array<number>, rootNodePathLocators: Set<HoisterLocator>, usedDependencyIds: Map<HoisterName, number>, hoistIdents: Map<HoisterName, HoisterIdent>, hoistIdentMap: Map<HoisterIdent, Array<HoisterIdent>>, parentShadowedNodes: ShadowedNodes, shadowedNodes: ShadowedNodes, options: InternalHoistOptions): {anotherRoundNeeded: boolean, isGraphChanged: boolean} => {
  const rootNodeId = rootNodePath[rootNodePath.length - 1];
  const rootNode = tree.nodes[rootNodeId];

  const seenNodes = new Set<number>();

  let anotherRoundNeeded = false;
  let isGraphChanged = false;

  const hoistNodeDependencies = (nodePath: Array<number>, locatorPath: Array<HoisterLocator>, aliasedLocatorPath: Array<AliasedLocator>, parentNodeId: number, newNodeIds: Set<number>) => {
    if (seenNodes.has(parentNodeId))
      return;

    const parentNode = tree.nodes[parentNodeId];

    const nextLocatorPath = [...locatorPath, getAliasedLocator(parentNode)];
    const nextAliasedLocatorPath = [...aliasedLocatorPath, getAliasedLocator(parentNode)];

    const dependantTree = new Map<HoisterName, Set<HoisterName>>();
    const hoistInfos = new Map<number, HoistInfo>();

    for (const subDependencyId of getSortedRegularDependencies(tree, parentNodeId)) {
      const subDependency = tree.nodes[subDependencyId];
      const hoistInfo = getNodeHoistInfo(tree, rootNodeId, rootNodePathLocators, [rootNodeId, ...nodePath, parentNodeId], subDependencyId, usedDependencyIds, hoistIdents, hoistIdentMap, shadowedNodes, {outputReason: options.debugLevel >= DebugLevel.REASONS, fastLookupPossible: options.fastLookupPossible});

      hoistInfos.set(subDependencyId, hoistInfo);

      if (hoistInfo.isHoistable === Hoistable.DEPENDS) {
        for (const nodeId of hoistInfo.dependsOn) {
          const node = tree.nodes[nodeId];
          const nodeDependants = miscUtils.getSetWithDefault(dependantTree, node.name);

          nodeDependants.add(subDependency.name);
        }
      }
    }

    const unhoistableNodes = new Set<number>();
    const addUnhoistableNode = (nodeId: number, hoistInfo: HoistInfo, reason: string) => {
      if (unhoistableNodes.has(nodeId))
        return;

      const node = tree.nodes[nodeId];

      unhoistableNodes.add(nodeId);
      hoistInfos.set(nodeId, {isHoistable: Hoistable.NO, reason});

      for (const dependantName of dependantTree.get(node.name) || []) {
        addUnhoistableNode(parentNode.dependencies.get(dependantName)!, hoistInfo, options.debugLevel >= DebugLevel.REASONS ? `- peer dependency ${prettyPrintLocator(node.locator)} from parent ${prettyPrintLocator(parentNode.locator)} was not hoisted` : ``);
      }
    };

    for (const [node, hoistInfo] of hoistInfos)
      if (hoistInfo.isHoistable === Hoistable.NO)
        addUnhoistableNode(node, hoistInfo, hoistInfo.reason!);

    let wereNodesHoisted = false;
    for (const nodeId of hoistInfos.keys()) {
      if (unhoistableNodes.has(nodeId))
        continue;

      isGraphChanged = true;
      wereNodesHoisted = true;

      const node = tree.nodes[nodeId];

      const shadowedNames = parentShadowedNodes.get(parentNodeId);
      if (shadowedNames && shadowedNames.has(node.name))
        anotherRoundNeeded = true;

      parentNode.dependencies.delete(node.name);
      parentNode.hoistedDependencies.set(node.name, nodeId);
      parentNode.reasons.delete(node.name);

      const hoistedNodeId = rootNode.dependencies.get(node.name);

      if (options.debugLevel >= DebugLevel.REASONS) {
        const hoistedFrom = Array.from(locatorPath)
          .concat([parentNode.locator])
          .map(x => prettyPrintLocator(x))
          .join(`→`);

        const hoistedFromArray = miscUtils.getArrayWithDefault(rootNode.hoistedFrom, node.name);
        hoistedFromArray.push(hoistedFrom!);

        const prettyLocatorString = Array.from(rootNodePath)
          .map(id => prettyPrintLocator(tree.nodes[id].locator))
          .join(`→`);

        parentNode.hoistedTo.set(node.name, prettyLocatorString);
      }

      // Add hoisted node to root node, in case it is not already there
      if (typeof hoistedNodeId === `undefined`) {
        // Avoid adding other version of root node to itself
        if (rootNode.ident !== node.ident) {
          rootNode.dependencies.set(node.name, nodeId);
          newNodeIds.add(nodeId);
        }
      } else {
        const hoistedNode = tree.nodes[hoistedNodeId];
        for (const reference of node.references) {
          hoistedNode.references.add(reference);
        }
      }
    }

    if (parentNode.dependencyKind === HoisterDependencyKind.EXTERNAL_SOFT_LINK && wereNodesHoisted)
      anotherRoundNeeded = true;

    if (options.check) {
      const checkLog = selfCheck(tree);
      if (checkLog) {
        throw new Error(`${checkLog}, after hoisting dependencies of ${[rootNodeId, ...nodePath, parentNodeId].map(id => prettyPrintLocator(tree.nodes[id].locator)).join(`→`)}:\n${dumpDepTree(tree)}`);
      }
    }

    const children = getSortedRegularDependencies(tree, parentNodeId);
    for (const nodeId of children) {
      if (!unhoistableNodes.has(nodeId))
        continue;

      const hoistInfo = hoistInfos.get(nodeId);
      if (!hoistInfo)
        throw new Error(`Assertion failed: Nodes should always have associated hoist info`);

      const node = tree.nodes[nodeId];

      const hoistableIdent = hoistIdents.get(node.name);
      if ((hoistableIdent === node.ident || !parentNode.reasons.has(node.name)) && hoistInfo.isHoistable !== Hoistable.YES)
        parentNode.reasons.set(node.name, hoistInfo.reason!);

      if (!node.isHoistBorder && !nextAliasedLocatorPath.includes(getAliasedLocator(node))) {
        seenNodes.add(parentNodeId);

        const decoupledNode = decoupleGraphNode(tree, parentNodeId, nodeId);
        hoistNodeDependencies([...nodePath, parentNodeId], nextLocatorPath, nextAliasedLocatorPath, decoupledNode, nextNewNodes);

        seenNodes.delete(parentNodeId);
      }
    }
  };

  const aliasedRootNodePathLocators = Array.from(rootNodePath)
    .map(x => getAliasedLocator(tree.nodes[x]));

  let nextNewNodes = new Set(getSortedRegularDependencies(tree, rootNodeId));

  while (nextNewNodes.size > 0) {
    const newNodes = nextNewNodes;
    nextNewNodes = new Set();

    for (const depId of newNodes) {
      const dep = tree.nodes[depId];
      if (dep.locator === rootNode.locator || dep.isHoistBorder)
        continue;

      const decoupledDependency = decoupleGraphNode(tree, rootNodeId, depId);
      hoistNodeDependencies([], Array.from(rootNodePathLocators), aliasedRootNodePathLocators, decoupledDependency, nextNewNodes);
    }
  }

  return {anotherRoundNeeded, isGraphChanged};
};

const selfCheck = (tree: HoisterWorkTree): string => {
  const log: Array<string> = [];

  const seenNodes = new Set<number>();
  const parents = new Set<number>();

  const checkNode = (nodeId: number, parentDepIds: Map<HoisterName, number>, parentId: number) => {
    if (seenNodes.has(nodeId))
      return;

    seenNodes.add(nodeId);

    if (parents.has(nodeId))
      return;

    const node = tree.nodes[nodeId];
    const clonedDepIds = new Map(parentDepIds);

    for (const depId of node.dependencies.values()) {
      const dep = tree.nodes[depId];
      if (!node.peerNames.has(dep.name)) {
        clonedDepIds.set(dep.name, depId);
      }
    }

    for (const origDepId of node.originalDependencies.values()) {
      const origDep = tree.nodes[origDepId];
      const depId = clonedDepIds.get(origDep.name);

      const prettyPrintTreePath = () => Array.from(parents)
        .concat([nodeId])
        .map(id => prettyPrintLocator(tree.nodes[id].locator))
        .join(`→`);

      if (node.peerNames.has(origDep.name)) {
        const parentDepId = parentDepIds.get(origDep.name);

        const parentDep = typeof parentDepId !== `undefined`
          ? tree.nodes[parentDepId]
          : null;

        if (!parentDep || parentDepId !== depId || parentDep.ident !== origDep.ident) {
          log.push(`${prettyPrintTreePath()} - broken peer promise: expected ${origDep!.ident} but found ${parentDep ? parentDep.ident : parentDep}`);
        }
      } else {
        const parent = tree.nodes[parentId];

        const hoistedFrom = parent.hoistedFrom.get(node.name);
        const originalHoistedTo = node.hoistedTo.get(origDep.name);

        const prettyHoistedFrom = `${hoistedFrom ? ` hoisted from ${hoistedFrom.join(`, `)}` : ``}`;
        const prettyOriginalHoistedTo = `${originalHoistedTo ? ` hoisted to ${originalHoistedTo}` : ``}`;
        const prettyNodePath = `${prettyPrintTreePath()}${prettyHoistedFrom}`;

        if (typeof depId === `undefined`) {
          log.push(`${prettyNodePath} - broken require promise: no required dependency ${origDep.name}${prettyOriginalHoistedTo} found`);
        } else {
          const dep = tree.nodes[depId];
          if (dep.ident !== origDep.ident) {
            log.push(`${prettyNodePath} - broken require promise for ${origDep.name}${prettyOriginalHoistedTo}: expected ${origDep.ident}, but found: ${dep.ident}`);
          }
        }
      }
    }

    parents.add(nodeId);

    for (const depId of node.dependencies.values()) {
      const dep = tree.nodes[depId];
      if (!node.peerNames.has(dep.name)) {
        checkNode(depId, clonedDepIds, nodeId);
      }
    }

    parents.delete(nodeId);
  };

  checkNode(tree.root, tree.nodes[tree.root].dependencies, tree.root);

  return log.join(`\n`);
};

/**
 * Creates a clone of package tree with extra fields used for hoisting purposes.
 *
 * @param tree package tree clone
 */
const cloneTree = (tree: HoisterTree, options: InternalHoistOptions): HoisterWorkTree => {
  const workNodes = tree.nodes.map(node => {
    const {
      id,
      identName,
      name,
      reference,
      peerNames,
      hoistPriority = 0,
      dependencyKind = HoisterDependencyKind.REGULAR,
    } = node;

    const workNode: HoisterWorkNode = {
      id,
      name,
      references: new Set([reference]),
      locator: makeLocator(identName, reference),
      ident: makeIdent(identName, reference),
      dependencies: new Map(Array.from(node.dependencies, id => [tree.nodes[id].name, id])),
      originalDependencies: new Map(Array.from(node.dependencies, id => [tree.nodes[id].name, id])),
      hoistedDependencies: new Map(),
      peerNames: new Set(peerNames),
      reasons: new Map(),
      decoupled: true,
      isHoistBorder: false,
      hoistPriority,
      dependencyKind,
      hoistedFrom: new Map(),
      hoistedTo: new Map(),
    };

    return workNode;
  });

  for (const workNode of workNodes) {
    const dependenciesNmHoistingLimits = options.hoistingLimits.get(workNode.locator);

    for (const dependency of workNode.dependencies.values()) {
      const dependencyWorkNode = workNodes[dependency];

      const isHoistBorder = dependenciesNmHoistingLimits
        ? dependenciesNmHoistingLimits.has(dependencyWorkNode.name)
        : false;

      // Mael: I noticed when refactoring from a tree to a flat array that
      // we only used to set the isHoistBorder flag the first time we see
      // the dependency node (because we were only setting the flag when the
      // node was being created). I suppose this was a mistake and the
      // package should be marked an hoist border if any of its parents
      // declare it as such; to confirm with @larixer?
      dependencyWorkNode.isHoistBorder ||= isHoistBorder;
    }

    const seenCoupledNodes = new Set<number>();

    const markNodeCoupled = (id: number) => {
      if (seenCoupledNodes.has(id))
        return;

      seenCoupledNodes.add(id);

      const workNode = workNodes[id];
      workNode.decoupled = false;

      for (const depId of workNode.dependencies.values()) {
        const dep = workNodes[depId];
        if (!workNode.peerNames.has(dep.name)) {
          markNodeCoupled(depId);
        }
      }
    };

    markNodeCoupled(workNode.id);
  }

  return {
    nodes: workNodes,
    root: tree.root,
  };
};

const getIdentName = (locator: HoisterLocator) => locator.substring(0, locator.indexOf(`@`, 1));

/**
 * Creates a clone of hoisted package tree with extra fields removed
 *
 * @param tree stripped down hoisted package tree clone
 */
const shrinkTree = (tree: HoisterWorkTree): HoisterResult => {
  const rootNode = tree.nodes[tree.root];

  const treeCopy: HoisterResult = {
    name: rootNode.name,
    identName: getIdentName(rootNode.locator),
    references: new Set(rootNode.references),
    dependencies: new Set(),
  };

  const seenNodes = new Set<number>([
    tree.root,
  ]);

  const addNode = (nodeId: number, parentWorkNodeId: number, parentNode: HoisterResult) => {
    const isSeen = seenNodes.has(nodeId);
    const node = tree.nodes[nodeId];

    let resultNode: HoisterResult;
    if (parentWorkNodeId === nodeId) {
      resultNode = parentNode;
    } else {
      resultNode = {
        name: node.name,
        identName: getIdentName(node.locator),
        references: node.references,
        dependencies: new Set(),
      };
    }

    parentNode.dependencies.add(resultNode);

    if (!isSeen) {
      seenNodes.add(nodeId);

      for (const depId of node.dependencies.values()) {
        const dep = tree.nodes[depId];
        if (!node.peerNames.has(dep.name)) {
          addNode(depId, nodeId, resultNode);
        }
      }

      seenNodes.delete(nodeId);
    }
  };

  for (const depId of rootNode.dependencies.values())
    addNode(depId, tree.root, treeCopy);

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
const buildPreferenceMap = (tree: HoisterWorkTree, rootNodeId: number): PreferenceMap => {
  const preferenceMap: PreferenceMap = new Map();

  const getPreferenceKey = (node: HoisterWorkNode) => {
    return `${node.name}@${node.ident}`;
  };

  const getOrCreatePreferenceEntry = (node: HoisterWorkNode) => {
    const key = getPreferenceKey(node);

    const entry = miscUtils.getFactoryWithDefault(preferenceMap, key, () => ({
      dependents: new Set(),
      peerDependents: new Set(),
      hoistPriority: 0,
    }));

    return entry;
  };

  const seenNodes = new Set<number>([tree.root]);

  const addDependent = (dependentId: number, nodeId: number) => {
    const dependent = tree.nodes[dependentId];
    const node = tree.nodes[nodeId];

    const isSeen = !!seenNodes.has(nodeId);

    const entry = getOrCreatePreferenceEntry(node);
    entry.dependents.add(dependent.ident);

    if (!isSeen) {
      seenNodes.add(nodeId);

      for (const depId of node.dependencies.values()) {
        const dep = tree.nodes[depId];

        const entry = getOrCreatePreferenceEntry(dep);
        entry.hoistPriority = Math.max(entry.hoistPriority, dep.hoistPriority);

        if (node.peerNames.has(dep.name)) {
          entry.peerDependents.add(node.ident);
        } else {
          addDependent(nodeId, depId);
        }
      }
    }
  };

  const rootNode = tree.nodes[rootNodeId];

  for (const depId of rootNode.dependencies.values()) {
    const dep = tree.nodes[depId];

    if (!rootNode.peerNames.has(dep.name)) {
      addDependent(rootNodeId, depId);
    }
  }

  return preferenceMap;
};

const prettyPrintLocator = (locator?: HoisterLocator) => {
  if (!locator)
    return `none`;

  const idx = locator.indexOf(`@`, 1);

  let name = locator.substring(0, idx);
  if (name.endsWith(`$wsroot$`))
    name = `wh:${name.replace(`$wsroot$`, ``)}`;

  const reference = locator.substring(idx + 1);
  if (!reference)
    return `${name}`;
  if (reference === `workspace:.`)
    return `.`;

  const sourceVersion = reference.split(`#`)[1] ?? reference;
  let version = sourceVersion.replace(`npm:`, ``);

  if (reference.startsWith(`virtual`))
    name = `v:${name}`;

  if (version.startsWith(`workspace`)) {
    name = `w:${name}`;
    version = ``;
  }

  return `${name}${version ? `@${version}` : ``}`;
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

const dumpDepTree = (tree: HoisterWorkTree) => {
  let nodeCount = 0;

  const dumpPackage = (pkgId: number, parents: Set<number>, prefix = ``): string => {
    if (nodeCount > MAX_NODES_TO_DUMP || parents.has(pkgId))
      return ``;

    nodeCount++;
    parents.add(pkgId);

    const pkg = tree.nodes[pkgId];

    const dependencies = Array.from(pkg.dependencies.values()).sort((nId1, nId2) => {
      const n1 = tree.nodes[nId1];
      const n2 = tree.nodes[nId2];

      return n1.name.localeCompare(n2.name);
    });

    let str = ``;

    for (let idx = 0; idx < dependencies.length; idx++) {
      const depId = dependencies[idx];
      if (depId !== pkgId)
        continue;

      const dep = tree.nodes[depId];
      if (pkg.peerNames.has(dep.name))
        continue;

      const reason = pkg.reasons.get(dep.name);
      const identName = getIdentName(dep.locator);

      str += `${prefix}${idx < dependencies.length - 1 ? `├─` : `└─`}${(parents.has(depId) ? `>` : ``) + (identName !== dep.name ? `a:${dep.name}:` : ``) +  prettyPrintLocator(dep.locator) + (reason ? ` ${reason}` : ``)}\n`;
      str += dumpPackage(depId, parents, `${prefix}${idx < dependencies.length - 1 ? `│ ` : `  `}`);
    }

    parents.delete(pkgId);

    return str;
  };

  let treeDump = dumpPackage(tree.root, new Set());

  if (nodeCount > MAX_NODES_TO_DUMP)
    treeDump += `\nTree is too large, part of the tree has been dumped.\n`;

  return treeDump;
};
