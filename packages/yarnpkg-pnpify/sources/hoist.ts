type PackageName = string;
export type HoisterTree = {name: PackageName, identName: PackageName, reference: string, dependencies: Set<HoisterTree>, peerNames: Set<PackageName>};
export type HoisterResult = {name: PackageName, identName: PackageName, references: Set<string>, dependencies: Set<HoisterResult>};
type Locator = string;
type Ident = string;
type HoisterWorkTree = {name: PackageName, references: Set<string>, ident: Ident, locator: Locator, dependencies: Map<PackageName, HoisterWorkTree>, originalDependencies: Map<PackageName, HoisterWorkTree>, hoistedDependencies: Map<PackageName, HoisterWorkTree>, peerNames: ReadonlySet<PackageName>, decoupled: boolean, reasons: Map<PackageName, string>};

/**
 * Mapping which packages depend on a given package alias + ident. It is used to determine hoisting weight,
 * e.g. which one among the group of packages with the same name should be hoisted.
 * The package having the biggest number of parents using this package will be hoisted.
 */
type PopularityMap = Map<string, Set<Ident>>;

const makeLocator = (name: string, reference: string) => `${name}@${reference}`;
const makeIdent = (name: string, reference: string) => {
  const hashIdx = reference.indexOf(`#`);
  // Strip virtual reference part, we don't need it for hoisting purposes
  const realReference = hashIdx >= 0 ? reference.substring(hashIdx + 1) : reference!;
  return makeLocator(name, realReference);
};

type HoistOptions = {
  check?: boolean;
  debugLevel?: number;
}

type InternalHoistOptions = {
  check?: boolean;
  debugLevel: number;
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
  const debugLevel = opts.debugLevel || Number(process.env.NM_DEBUG_LEVEL || -1);
  const check = opts.check || debugLevel >= 9;
  const options: InternalHoistOptions = {check, debugLevel};

  if (options.debugLevel >= 0)
    console.time(`hoist`);

  const treeCopy = cloneTree(tree);

  hoistTo(treeCopy, treeCopy, new Set([treeCopy.locator]), options);

  if (options.debugLevel >= 0)
    console.timeEnd(`hoist`);

  if (options.debugLevel >= 1) {
    const checkLog = selfCheck(treeCopy);
    if (checkLog) {
      throw new Error(`${checkLog}, after hoisting finished:\n${dumpDepTree(treeCopy)}`);
    }
  }

  if (options.debugLevel >= 2)
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

  const {name, references, ident, locator, dependencies, originalDependencies, hoistedDependencies, peerNames, reasons} = node;
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
  };
  const selfDep = clone.dependencies.get(name);
  if (selfDep && selfDep.ident == clone.ident)
    // Update self-reference
    clone.dependencies.set(name, clone);

  parent.dependencies.set(clone.name, clone);

  return clone;
};

/**
 * Builds a map of most popular packages that might be hoisted to the root node.
 *
 * The values in the map are idents sorted by popularity from most popular to less popular.
 * If the root node has already some version of a package, the value array will contain only
 * one element, since it is not possible for other versions of a package to be hoisted.
 *
 * @param rootNode root node
 * @param popularityMap popularity map
 */
const getHoistIdentMap = (rootNode: HoisterWorkTree, popularityMap: PopularityMap): Map<PackageName, Array<Ident>> => {
  const identMap = new Map<PackageName, Array<Ident>>([[rootNode.name, [rootNode.ident]]]);

  for (const dep of rootNode.dependencies.values()) {
    if (!rootNode.peerNames.has(dep.name)) {
      identMap.set(dep.name, [dep.ident]);
    }
  }

  const keyList = Array.from(popularityMap.keys());
  keyList.sort((key1, key2) => popularityMap.get(key2)!.size - popularityMap.get(key1)!.size);

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
 * @param options hoisting options
 */
const hoistTo = (tree: HoisterWorkTree, rootNode: HoisterWorkTree, rootNodePath: Set<Locator>, options: InternalHoistOptions, seenNodes: Set<HoisterWorkTree> = new Set()) => {
  if (seenNodes.has(rootNode))
    return;
  seenNodes.add(rootNode);

  const popularityMap = buildPopularityMap(rootNode);

  const hoistIdentMap = getHoistIdentMap(rootNode, popularityMap);

  const hoistIdents = new Set(Array.from(hoistIdentMap.values()).map(x => x[0]));

  const hoistedDependencies = rootNode === tree ? new Map() : getHoistedDependencies(rootNode);

  let wasStateChanged;
  do {
    hoistGraph(tree, rootNode, rootNodePath, hoistedDependencies, hoistIdents, hoistIdentMap, options);
    wasStateChanged = false;
    for (const [name, idents] of hoistIdentMap) {
      if (idents.length > 1 && !rootNode.dependencies.has(name)) {
        hoistIdents.delete(idents[0]);
        idents.shift();
        hoistIdents.add(idents[0]);
        wasStateChanged = true;
      }
    }
  } while (wasStateChanged);

  for (const dependency of rootNode.dependencies.values()) {
    if (!rootNode.peerNames.has(dependency.name) && !rootNodePath.has(dependency.locator)) {
      rootNodePath.add(dependency.locator);
      hoistTo(tree, dependency, rootNodePath, options);
      rootNodePath.delete(dependency.locator);
    }
  }
};

/**
 * Gets regular node dependencies only and sorts them in the order so that
 * peer dependencies come before the dependency that rely on them.
 *
 * @param node graph node
 * @returns sorted regular dependencies
 */
const getSortedReglarDependencies = (node: HoisterWorkTree): Set<HoisterWorkTree> => {
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
 * Performs actual graph transformation, by hoisting packages to the root node.
 *
 * @param tree dependency tree
 * @param rootNode root package node
 * @param rootNodePath root node path in the tree
 * @param hoistedDependencies map of dependencies that were hoisted to parent nodes
 * @param hoistIdents idents that should be attempted to be hoisted to the root node
 */
const hoistGraph = (tree: HoisterWorkTree, rootNode: HoisterWorkTree, rootNodePath: Set<Locator>, hoistedDependencies: Map<PackageName, HoisterWorkTree>, hoistIdents: Set<Ident>, hoistIdentMap: Map<Ident, Array<Ident>>, options: InternalHoistOptions) => {
  const seenNodes = new Set<HoisterWorkTree>();

  const hoistNode = (nodePath: Array<HoisterWorkTree>, locatorPath: Array<Locator>, node: HoisterWorkTree, newNodes: Set<HoisterWorkTree>) => {
    if (seenNodes.has(node))
      return;

    let reasonRoot;
    let reason: string;
    if (options.debugLevel >= 2)
      reasonRoot = `${Array.from(rootNodePath).map(x => prettyPrintLocator(x)).join(`→`)}`;

    let isHoistable = hoistIdents.has(node.ident);
    if (options.debugLevel >= 2 && !isHoistable)
      reason = `- filled by: ${prettyPrintLocator(hoistIdentMap.get(node.name)![0])} at ${reasonRoot}`;

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
            if (options.debugLevel >= 2)
              reason = `- peer dependency ${prettyPrintLocator(parentDepNode.locator)} from parent ${prettyPrintLocator(parent.locator)} was not hoisted to ${reasonRoot}`;
            arePeerDepsSatisfied = false;
            break;
          }
          checkList.delete(name);
        }
        if (!arePeerDepsSatisfied) {
          break;
        }
      }
      isHoistable = arePeerDepsSatisfied;
    }

    if (isHoistable) {
      let isNameAvailable = false;
      const hoistedDep = hoistedDependencies.get(node.name);
      isNameAvailable = (!hoistedDep || hoistedDep.ident === node.ident);
      if (options.debugLevel >= 2 && !isNameAvailable)
        reason = `- filled by: ${prettyPrintLocator(hoistedDep!.locator)} at ${reasonRoot}`;
      if (isNameAvailable) {
        for (let idx = 1; idx < nodePath.length - 1; idx++) {
          const parent = nodePath[idx];
          const parentDep = parent.dependencies.get(node.name);
          if (parentDep && parentDep.ident !== node.ident) {
            isNameAvailable = false;
            if (options.debugLevel >= 2)
              reason = `- filled by: ${prettyPrintLocator(parentDep!.locator)} at ${prettyPrintLocator(parent.locator)}`;
            break;
          }
        }
      }

      isHoistable = isNameAvailable;
    }

    if (isHoistable) {
      const parentNode = nodePath[nodePath.length - 1];
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
      if (options.check) {
        const checkLog = selfCheck(tree);
        if (checkLog) {
          throw new Error(`${checkLog}, after hoisting ${[rootNode, ...nodePath, node].map(x => prettyPrintLocator(x.locator)).join(`→`)}:\n${dumpDepTree(tree)}`);
        }
      }
    } else if (options.debugLevel >= 2) {
      const parent = nodePath[nodePath.length - 1];
      parent.reasons.set(node.name, reason!);
    }

    if (!isHoistable && locatorPath.indexOf(node.locator) < 0) {
      const decoupledNode = decoupleGraphNode(nodePath[nodePath.length - 1], node);
      seenNodes.add(decoupledNode);

      for (const dep of getSortedReglarDependencies(node))
        hoistNode([...nodePath, decoupledNode], [...locatorPath, node.locator], dep, newNodes);

      seenNodes.delete(decoupledNode);
    }
  };

  let newNodes;
  let nextNewNodes = new Set(rootNode.dependencies.values());
  do {
    newNodes = nextNewNodes;
    nextNewNodes = new Set();
    for (const dep of newNodes) {
      if (rootNode.peerNames.has(dep.name) || dep.locator === rootNode.locator)
        continue;
      const decoupledDep = decoupleGraphNode(rootNode, dep);
      seenNodes.add(decoupledDep);

      for (const subDep of getSortedReglarDependencies(dep)) {
        if (subDep.locator !== dep.locator) {
          hoistNode([rootNode, decoupledDep], [rootNode.locator, dep.locator], subDep, nextNewNodes);
        }
      }

      seenNodes.delete(decoupledDep);
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
        if (parentDep !== dep) {
          log.push(`${prettyPrintTreePath()} - broken peer promise: expected ${dep!.locator} but found ${parentDep ? parentDep.locator : parentDep}`);
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
const cloneTree = (tree: HoisterTree): HoisterWorkTree => {
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
  };

  const seenNodes = new Map<HoisterTree, HoisterWorkTree>([[tree, treeCopy]]);

  const addNode = (node: HoisterTree, parentNode: HoisterWorkTree) => {
    // Skip self-references
    let workNode = seenNodes.get(node);
    const isSeen = !!workNode;
    if (!workNode) {
      const {name, identName, reference, peerNames} = node;
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
 * @returns popularity map
 */
const buildPopularityMap = (rootNode: HoisterWorkTree): PopularityMap => {
  const popularityMap: PopularityMap = new Map();

  const seenNodes = new Set<HoisterWorkTree>([rootNode]);
  const getPopularityKey = (node: HoisterWorkTree) => `${node.name}@${node.ident}`;

  const addParent = (parentNode: HoisterWorkTree, node: HoisterWorkTree) => {
    const isSeen = !!seenNodes.has(node);

    const key = getPopularityKey(node);
    let parents = popularityMap.get(key);
    if (!parents) {
      parents = new Set<Ident>();
      popularityMap.set(key, parents);
    }
    parents.add(parentNode.ident);

    if (!isSeen) {
      seenNodes.add(node);
      for (const dep of node.dependencies.values()) {
        if (!node.peerNames.has(dep.name)) {
          addParent(node, dep);
        }
      }
    }
  };

  for (const dep of rootNode.dependencies.values())
    if (!rootNode.peerNames.has(dep.name))
      addParent(rootNode, dep);

  return popularityMap;
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
