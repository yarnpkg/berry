type PackageName = string;
export type HoisterTree = {name: PackageName, reference: string, dependencies: Set<HoisterTree>, peerNames: Set<PackageName>};
export type HoisterResult = {name: PackageName, references: Set<string>, dependencies: Set<HoisterResult>};
type Locator = string;
type PhysicalLocator = string;
type HoisterWorkTree = {name: PackageName, references: Set<string>, physicalLocator: PhysicalLocator, locator: Locator, dependencies: Map<PackageName, HoisterWorkTree>, originalDependencies: Map<PackageName, HoisterWorkTree>, hoistedDependencies: Map<PackageName, HoisterWorkTree>, peerNames: ReadonlySet<PackageName>, reasons: Map<PackageName, string>};

type HoistTuple = {
  node: HoisterWorkTree,
  parent: HoisterWorkTree,
}

type HoistCandidate = HoistTuple & {
  drop: boolean
};

const DEBUG_LEVEL = Number(process.env.NM_DEBUG_LEVEL || -1);

/**
 * Mapping which packages depend on a given package. It is used to determine hoisting weight,
 * e.g. which one among the group of packages with the same name should be hoisted.
 * The package having the biggest number of ancestors using this package will be hoisted.
 */
type AncestorMap = Map<PhysicalLocator, Set<PhysicalLocator>>;

const makeLocator = (name: string, reference: string) => `${name}@${reference}`;
const makePhysicalLocator = (name: string, reference: string) => {
  const hashIdx = reference.indexOf('#');
  // Strip virtual reference part, we don't need it for hoisting purposes
  const realReference = hashIdx >= 0 ? reference.substring(hashIdx + 1) : reference!;
  return makeLocator(name, realReference);
};

type HoistOptions = {
  check?: boolean;
  finalCheck?: boolean;
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
export const hoist = (tree: HoisterTree, options: HoistOptions = {}): HoisterResult => {
  const treeCopy = cloneTree(tree);
  const ancestorMap = buildAncestorMap(treeCopy);
  const heaviestPackages = getHeaviestPackages(ancestorMap);

  let startTime: number;
  if (DEBUG_LEVEL >= 0)
    startTime = Date.now();
  while (hoistTo(treeCopy, treeCopy, new Set(), new Map(), ancestorMap, options, heaviestPackages) > 0);
  while (hoistTo(treeCopy, treeCopy, new Set(), new Map(), ancestorMap, options) > 0);

  if (options.finalCheck)
    selfCheck(treeCopy);

  if (DEBUG_LEVEL >= 0)
    console.log(`hoist time: ${Date.now() - startTime!}ms`);
  if (DEBUG_LEVEL >= 1)
    console.log(dumpDepTree(treeCopy));

  return shrinkTree(treeCopy);
};

const getHeaviestPackages = (ancestorMap: AncestorMap): Set<PhysicalLocator> => {
  const packageInfo = new Map<PackageName, {weight: number, locator: PhysicalLocator}>();

  for (const [locator, ancestors] of ancestorMap.entries()) {
    const name = locator.substring(0, locator.indexOf('@', 1));
    const pkg = packageInfo.get(name);
    const weight = ancestors.size;
    if (!pkg || pkg.weight < weight) {
      packageInfo.set(name, {weight, locator});
    }
  }

  const result = new Set<PhysicalLocator>();
  for (const pkg of packageInfo.values())
    result.add(pkg.locator);

  return result;
};

const selfCheck = (tree: HoisterWorkTree): string => {
  let log: string[] = [];

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
      const prettyPrintTreePath = () => `${Array.from(parents).concat([node]).map(x => prettyPrintLocator(x.locator)).join('→')}`;
      if (node.peerNames.has(origDep.name)) {
        const parentDep = parentDeps.get(origDep.name);
        if (parentDep !== dep) {
          log.push(`${prettyPrintTreePath()} - broken peer promise: expected ${dep!.locator} but found ${parentDep ? parentDep.locator : parentDep}`);
        }
      } else {
        if (!dep) {
          log.push(`${prettyPrintTreePath()} - broken require promise: no required dependency ${origDep.locator} found`);
        } else if (dep.physicalLocator !== origDep.physicalLocator) {
          log.push(`${prettyPrintTreePath()} - broken require promise: expected ${origDep.physicalLocator}, but found: ${dep.physicalLocator}`);
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

  return log.join('\n');
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
 * on triples of packages at a time:
 * `root package` -> `parent package` -> `dependency`
 * We check wether we can hoist `dependency` to `root package`, this boils down basically
 * to checking:
 * 1. Wether `root package` does not depend on other version of `dependency`
 * 2. Wether all the peer dependencies of a `dependency` had already been hoisted from `parent package`
 *
 * If many versions of the `dependency` can be hoisted to the `root package` we choose the most used
 * `dependency` version in the project among them.
 *
 * This algorithm is shallow first, e.g. it transforms the tree:
 * . -> A -> B -> C
 * in this order:
 * 1) . -> A
 *      -> B -> C
 * 2) . -> A
 *      -> B
 *      -> C
 *
 * This function mutates the tree.
 *
 * @param tree package dependencies graph
 * @param rootNode root node to hoist to
 * @param parentAncestorDependencies commulative dependencies of all root node ancestors, excluding root node dependenciew
 * @param ancestorMap ancestor map
 * @param options hoisting options
 * @param hoistBlacklistMap root node -> blacklisted nodes from hoisting list
 * @param whitelist if present specifies physical locators of the packages that should be hoisted
 */
const hoistTo = (tree: HoisterWorkTree, rootNode: HoisterWorkTree, parents: Set<HoisterWorkTree>, parentAncestorDependencies: Map<PackageName, HoisterWorkTree>, ancestorMap: AncestorMap, options: HoistOptions, whitelist?: Set<PhysicalLocator>, seenNodes: Set<HoisterWorkTree> = new Set(), hoistBlacklistMap = new Map()): number => {
  if (seenNodes.has(rootNode))
    return 0;
  seenNodes.add(rootNode);

  let hoistBlacklist = hoistBlacklistMap.get(rootNode);
  if (!hoistBlacklist) {
    hoistBlacklist = new Set<HoisterWorkTree>();
    hoistBlacklistMap.set(rootNode, hoistBlacklist);
  }

  // Perform shallow-first hoisting by hoisting to the root node first
  let totalHoisted = hoistPass(tree, rootNode, parents, parentAncestorDependencies, ancestorMap, options, hoistBlacklist, whitelist);

  const ancestorDependencies = new Map(parentAncestorDependencies);
  for (const dep of rootNode.dependencies.values())
    if (!rootNode.peerNames.has(dep.name))
      ancestorDependencies.set(dep.name, dep);

  let childrenHoisted = 0;
  // Now perform children hoisting
  parents.add(rootNode);
  for (const dep of rootNode.dependencies.values())
    childrenHoisted += hoistTo(tree, dep, parents, ancestorDependencies, ancestorMap, options, whitelist, seenNodes, hoistBlacklistMap);
  parents.delete(rootNode);

  if (childrenHoisted > 0)
    // Perfrom 2nd pass of hoisting to the root node, because some of the children were hoisted
    totalHoisted += childrenHoisted + hoistPass(tree, rootNode, parents, parentAncestorDependencies, ancestorMap, options, hoistBlacklist, whitelist);

  return totalHoisted;
};

const hoistPass = (tree: HoisterWorkTree, rootNode: HoisterWorkTree, parents: Set<HoisterWorkTree>, parentAncestorDependencies: Map<PackageName, HoisterWorkTree>, ancestorMap: AncestorMap, options: HoistOptions, hoistBlacklist: Set<HoisterWorkTree>, whitelist?: Set<PhysicalLocator>): number => {
  let totalHoisted = 0;
  let hoistablePackages: Set<HoistCandidate>;
  const clonedNodes = new Map<HoisterWorkTree, HoisterWorkTree>();

  const ancestorDependencies = new Map(parentAncestorDependencies);
  for (const dep of rootNode.dependencies.values())
    if (!rootNode.peerNames.has(dep.name))
      ancestorDependencies.set(dep.name, dep);

  do {
    hoistablePackages = getHoistablePackages(rootNode, parents, ancestorDependencies, ancestorMap, hoistBlacklist, whitelist);
    totalHoisted += hoistablePackages.size;
    for (let {parent, node, drop} of hoistablePackages) {
      let parentNode = clonedNodes.get(parent);
      if (!parentNode) {
        const {name, references, physicalLocator, locator, dependencies, originalDependencies, hoistedDependencies, peerNames, reasons} = parent!;
        // To perform node hoisting from parent node we must clone parent node first,
        // because some other package in the tree might depend on the parent package where hoisting
        // cannot be performed
        parentNode = {
          name,
          references: new Set(references),
          physicalLocator,
          locator,
          dependencies: new Map(dependencies),
          originalDependencies: new Map(originalDependencies),
          hoistedDependencies: new Map(hoistedDependencies),
          peerNames: new Set(peerNames),
          reasons: new Map(reasons),
        };
        clonedNodes.set(parent, parentNode);
        rootNode.dependencies.set(parentNode.name, parentNode);
      }
      // Delete hoisted node from parent node
      parentNode.dependencies.delete(node.name);
      parentNode.reasons.delete(node.name);
      parentNode.hoistedDependencies.set(node.name, node);

      const hoistedNode = rootNode.dependencies.get(node.name);
      // Add hoisted node to root node, in case it is not already there
      if (!hoistedNode) {
        if (!drop) {
          rootNode.dependencies.set(node.name, node);
          ancestorDependencies.set(node.name, node);
        }
      } else {
        for (const reference of node.references) {
          hoistedNode.references.add(reference);
        }
      }
      if (options.check) {
        const checkLog = selfCheck(tree);
        if (checkLog) {
          throw new Error(`${checkLog}, after hoisting ${[rootNode, parent, node].map(x => prettyPrintLocator(x.locator)).join('→')}:\n${dumpDepTree(tree)}`);
        }
      }
    }
  } while (hoistablePackages.size > 0);

  return totalHoisted;
};

type HoistCandidateMap = Map<PackageName, {physicalLocator: PhysicalLocator, locator: Locator, candidates: Set<HoistTuple>, weight: number}>;

/**
 * Finds all the packages that can be hoisted to the root package node from the set of:
 * `root node` -> `dependency` -> `subdependency`
 *
 * @param rootNode root package node
 * @param ancestorDependencies commulative dependencies of all root node ancestors, including root node dependencies
 * @param ancestorMap ancestor map to determine `dependency` version popularity
 * @param whitelist if present specifies physical locators of the packages that should be hoisted
 */
const getHoistablePackages = (rootNode: HoisterWorkTree, parents: Set<HoisterWorkTree>, ancestorDependencies: Map<PackageName, HoisterWorkTree>, ancestorMap: AncestorMap, hoistBlacklist: Set<HoisterWorkTree>, whitelist?: Set<PhysicalLocator>): Set<HoistCandidate> => {
  const hoistCandidateMap: HoistCandidateMap = new Map();
  const dropCandidates = new Set<HoistTuple>();

  const computeHoistCandidates = (parentNode: HoisterWorkTree, node: HoisterWorkTree, treePath: Set<HoisterWorkTree>) => {
    if (whitelist && !whitelist.has(node.physicalLocator))
      return;
    let isHoistable: boolean = true;
    let reasonRoot;
    let reason: string;
    if (DEBUG_LEVEL >= 1)
      reasonRoot = `${Array.from(treePath).map(x => prettyPrintLocator(x.locator)).join('→')}`;

    let isRegularDepAtRoot = false;
    if (isHoistable) {
      const ancestorDep = ancestorDependencies.get(node.name);
      isRegularDepAtRoot = (ancestorDep && ancestorDep.physicalLocator === node.physicalLocator) || !rootNode.peerNames.has(node.name);
      if (DEBUG_LEVEL >= 1 && !isRegularDepAtRoot)
        reason = `- is a peer dependency at ${reasonRoot}`;
      isHoistable = isRegularDepAtRoot;
    }

    let competitorInfo = hoistCandidateMap.get(node.name);

    const ancestorNode = ancestorMap.get(node.physicalLocator)!;
    const weight = ancestorNode.size;

    let isCompatiblePhysicalLocator = false;
    if (isHoistable) {
      isCompatiblePhysicalLocator = (rootNode.name !== node.name || rootNode.physicalLocator === node.physicalLocator);
      if (DEBUG_LEVEL >= 1 && !isCompatiblePhysicalLocator)
        reason = `- conflicts with ${reasonRoot}`;

      isHoistable = isCompatiblePhysicalLocator;
    }

    let isNameAvailable = false;
    const rootDep = rootNode.dependencies.get(node.name);
    if (isHoistable) {
      const origRootDep = rootNode.originalDependencies.get(node.name);
      isNameAvailable = (!rootDep || rootDep.physicalLocator === node.physicalLocator)
          && (!origRootDep || origRootDep.physicalLocator === node.physicalLocator);
      if (DEBUG_LEVEL >= 1 && !isNameAvailable)
        reason = `- filled by: ${prettyPrintLocator(rootDep ? rootDep.locator : origRootDep!.locator)} at ${reasonRoot}`;

      isHoistable = isNameAvailable;
    }

    let areRegularDepsSatisfied = true;
    if (isHoistable && !rootDep) {
      // Check that hoisted dependencies of current node are satisifed
      for (const dep of node.hoistedDependencies.values()) {
        if (node.originalDependencies.has(dep.name)) {
          const depNode = ancestorDependencies.get(dep.name);
          if (!depNode) {
            if (DEBUG_LEVEL >= 1)
              reason = `- hoisted dependency ${prettyPrintLocator(dep.locator)} is absent at ${reasonRoot}`;
            areRegularDepsSatisfied = false;
          } else if (depNode.physicalLocator !== dep.physicalLocator) {
            if (DEBUG_LEVEL >= 1)
              reason = `- hoisted dependency ${prettyPrintLocator(dep.locator)} has conflict with ${prettyPrintLocator(depNode.locator)} at ${reasonRoot}`;
            hoistBlacklist.add(node);
            areRegularDepsSatisfied = false;
          }
        }
        if (!areRegularDepsSatisfied) {
          break;
        }
      }
      isHoistable = areRegularDepsSatisfied;
    }

    let arePeerDepsSatisfied = true;
    if (isHoistable) {
      for (const name of node.peerNames) {
        const parentDepNode = parentNode.dependencies.get(name);
        if (parentDepNode) {
          if (DEBUG_LEVEL >= 1)
            reason = `- peer dependency ${prettyPrintLocator(parentDepNode.locator)} from parent ${prettyPrintLocator(parentNode.locator)} was not hoisted to ${reasonRoot}`;
          arePeerDepsSatisfied = false;
          break;
        }
      }
      isHoistable = arePeerDepsSatisfied;
    }

    if (isHoistable) {
      if ((rootDep && node.physicalLocator === rootDep.physicalLocator) || node.physicalLocator === rootNode.physicalLocator) {
        dropCandidates.add({parent: parentNode, node});
        isHoistable = false;
      }
    }

    let isPreferred = false;
    if (isHoistable) {
      // If there is a competitor package to be hoisted, we should prefer the package with more usage
      isPreferred = !competitorInfo || competitorInfo.weight <= weight;
      if (DEBUG_LEVEL >= 1 && !isPreferred)
        reason = `- preferred package ${competitorInfo!.locator} at ${reasonRoot}`;
      isHoistable = isPreferred;
    } else {
      hoistBlacklist.add(node);
    }

    if (isHoistable) {
      let hoistCandidate = hoistCandidateMap.get(node.name);
      if (!hoistCandidate || (competitorInfo && competitorInfo.physicalLocator !== node.physicalLocator)) {
        hoistCandidate = {locator: node.locator, physicalLocator: node.physicalLocator, candidates: new Set(), weight};
        hoistCandidateMap.set(node.name, hoistCandidate);
      }
      hoistCandidate.candidates.add({parent: parentNode, node});
    } else if (DEBUG_LEVEL >= 1) {
      parentNode.reasons.set(node.name, reason!);
    }
  };

  parents.add(rootNode);
  for (const dep of rootNode.dependencies.values()) {
    for (const subDep of dep.dependencies.values()) {
      computeHoistCandidates(dep, subDep, parents);
    }
  }
  parents.delete(rootNode);

  const hoistCandidates = new Set<HoistCandidate>();
  for (const {candidates} of hoistCandidateMap.values())
    for (const candidate of candidates)
      hoistCandidates.add({...candidate, drop: false});
  for (const candidate of dropCandidates)
    hoistCandidates.add({...candidate, drop: true});

  return hoistCandidates;
};

/**
 * Creates a clone of package tree with extra fields used for hoisting purposes.
 *
 * @param tree package tree clone
 */
const cloneTree = (tree: HoisterTree): HoisterWorkTree => {
  const {name, reference, peerNames} = tree;
  const treeCopy: HoisterWorkTree = {
    name,
    references: new Set([reference]),
    locator: makeLocator(name, reference),
    physicalLocator: makePhysicalLocator(name, reference),
    dependencies: new Map(),
    originalDependencies: new Map(),
    hoistedDependencies: new Map(),
    peerNames: new Set(peerNames),
    reasons: new Map(),
  };

  const seenNodes = new Map<HoisterTree, HoisterWorkTree>([[tree, treeCopy]]);

  const addNode = (origParent: HoisterTree, node: HoisterTree, parentNode: HoisterWorkTree) => {
    // Skip self-references
    if (node === origParent)
      return;
    let workNode = seenNodes.get(node);
    const isSeen = !!workNode;
    if (!workNode) {
      const {name, reference, peerNames} = node;
      workNode = {
        name,
        references: new Set([reference]),
        locator: makeLocator(name, reference),
        physicalLocator: makePhysicalLocator(name, reference),
        dependencies: new Map(),
        originalDependencies: new Map(),
        hoistedDependencies: new Map(),
        peerNames: new Set(peerNames),
        reasons: new Map(),
      };
      seenNodes.set(node, workNode);
    }

    parentNode.dependencies.set(workNode.name, workNode);
    parentNode.originalDependencies.set(workNode.name, workNode);

    if (!isSeen) {
      for (const dep of node.dependencies) {
        addNode(node, dep, workNode);
      }
    }
  };

  for (const dep of tree.dependencies)
    addNode(tree, dep, treeCopy);

  return treeCopy;
};

/**
 * Creates a clone of hoisted package tree with extra fields removed
 *
 * @param tree stripped down hoisted package tree clone
 */
const shrinkTree = (tree: HoisterWorkTree): HoisterResult => {
  const treeCopy: HoisterResult = {
    name: tree.name,
    references: new Set(tree.references),
    dependencies: new Set(),
  };

  const nodes = new Map<HoisterWorkTree, HoisterResult>([[tree, treeCopy]]);

  const addNode = (node: HoisterWorkTree, parentNode: HoisterResult) => {
    let resultNode = nodes.get(node);
    const isSeen = !!resultNode;

    if (!resultNode) {
      const {name, references} = node;
      resultNode = {
        name, references, dependencies: new Set<HoisterResult>(),
      };
    }

    parentNode.dependencies.add(resultNode);

    if (!isSeen) {
      for (const dep of node.dependencies.values()) {
        if (!node.peerNames.has(dep.name)) {
          addNode(dep, resultNode);
        }
      }
    }
  };

  for (const dep of tree.dependencies.values())
    addNode(dep, treeCopy);

  return treeCopy;
};

/**
 * Builds mapping, where key is a dependent package locator and the value is the list of
 * ancestors who depend on this package.
 *
 * @param tree package tree
 *
 * @returns ancestor map
 */
const buildAncestorMap = (tree: HoisterWorkTree): AncestorMap => {
  const ancestorMap: AncestorMap = new Map();

  const parentNodes = new Set<HoisterWorkTree>([tree]);

  const addParent = (node: HoisterWorkTree) => {
    if (parentNodes.has(node))
      return;

    let parents = ancestorMap.get(node.physicalLocator);
    if (!parents) {
      parents = new Set<PhysicalLocator>();
      ancestorMap.set(node.physicalLocator, parents);
    }
    for (const parent of parentNodes)
      parents.add(parent.physicalLocator);

    parentNodes.add(node);
    for (const dep of node.dependencies.values())
      if (!node.peerNames.has(dep.name))
        addParent(dep);

    parentNodes.delete(node);
  };

  for (const dep of tree.dependencies.values())
    if (!tree.peerNames.has(dep.name))
      addParent(dep);

  return ancestorMap;
};

const prettyPrintLocator = (locator: Locator) => {
  const idx = locator.indexOf('@', 1);
  const name = locator.substring(0, idx);
  const reference = locator.substring(idx + 1);
  if (reference === 'workspace:.') {
    return `.`;
  } else if (!reference) {
    return `${name}`;
  } else {
    const version = (reference.indexOf('#') > 0 ? reference.split('#')[1] : reference).replace('npm:', '');
    if (reference.startsWith('virtual')) {
      return `v:${name}@${version}`;
    } else {
      return `${name}@${version}`;
    }
  }
};

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
  const dumpPackage = (pkg: HoisterWorkTree, parents: Set<HoisterWorkTree>, prefix = ''): string => {
    if (parents.has(pkg))
      return '';

    const dependencies = Array.from(pkg.dependencies.values());

    let str = '';
    parents.add(pkg);
    for (let idx = 0; idx < dependencies.length; idx++) {
      const dep = dependencies[idx];
      const reason = pkg.reasons.get(dep.name);
      str += `${prefix}${idx < dependencies.length - 1 ? '├─' : '└─'}${(parents.has(dep) ? '>' : '') + prettyPrintLocator(dep.locator) + (reason ? ` ${reason}`: '')}\n`;
      str += dumpPackage(dep, parents, `${prefix}${idx < dependencies.length - 1 ?'│ ' : '  '}`);
    }
    parents.delete(pkg);
    return str;
  };

  return dumpPackage(tree, new Set());
};
