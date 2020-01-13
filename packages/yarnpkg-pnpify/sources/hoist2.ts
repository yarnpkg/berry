export type HoisterTree = {name: string, reference: string, deps: Set<HoisterTree>, peerNames: Set<string>, [meta: string]: any};
export type HoisterResult = {name: string, reference: string, deps: Set<HoisterResult>, [meta: string]: any};

/**
 * Package locator is a string that uniquiely identifies package and its version.
 */
type Locator = string;
type Package = {name: string, reference: string, locator: Locator, deps: Set<Package>, depNames: Map<string, Locator>, hoistedDeps: Map<string, Locator>, peerNames: Set<string>, [meta: string]: any};

/**
 * Mapping which packages depend on a given package. It is used to determine hoisting weight,
 * e.g. which one among the group of packages with the same name should be hoisted.
 * The package having the biggest number of ancestors using this package will be hoisted.
 */
type AncestorMap = Map<Locator, Set<Locator>>;

const makeLocator = (name: string, reference: string) => `${name}@${reference}`;

/**
 * Creates a clone of package tree with extra fields used for hoisting purposes.
 *
 * @param tree package tree clone
 */
const cloneTree = (tree: HoisterTree): Package => {
  const {name, reference, deps, peerNames, ...meta} = tree;
  const treeCopy: Package = {
    name,
    reference,
    locator: makeLocator(name, reference),
    deps: new Set(),
    depNames: new Map(),
    hoistedDeps: new Map(),
    peerNames: new Set(peerNames),
    ...meta,
  };

  const seenPkgs = new Set<HoisterTree>();

  const copySubTree = (srcPkg: HoisterTree, dstPkg: Package) => {
    if (seenPkgs.has(srcPkg))
      return;
    seenPkgs.add(srcPkg);

    for (const depPkg of srcPkg.deps) {
      const locator = makeLocator(depPkg.name, depPkg.reference);
      // Strip all self-references
      if (locator === dstPkg.locator)
        continue;

      const {name, reference, deps, peerNames, ...meta} = depPkg;
      const pkg: Package = {
        name,
        reference,
        locator,
        deps: new Set(),
        hoistedDeps: new Map(),
        depNames: new Map([[name, locator]]),
        peerNames: new Set(peerNames),
        ...meta,
      };
      dstPkg.deps.add(pkg);
      dstPkg.depNames.set(pkg.name, pkg.locator);
      copySubTree(depPkg, pkg);
    }
    for (const name of dstPkg.peerNames) {
      if (!dstPkg.depNames.has(name)) {
        throw new Error(`Assertion failed: Package ${dstPkg.locator} has no dependency for peerName: ${name}`);
      }
    }
  };

  copySubTree(tree, treeCopy);

  return treeCopy;
};

/**
 * Creates a clone of hoisted package tree with extra fields removed
 *
 * @param tree stripped down hoisted package tree clone
 */
const shrinkTree = (tree: Package): HoisterResult => {
  const {name, reference, locator, deps, depNames, hoistedDeps, peerNames, ...meta} = tree;
  const treeCopy: HoisterResult = {name, reference, deps: new Set(), ...meta};

  const seenPkgs = new Set<Package>();

  const copySubTree = (srcPkg: Package, dstPkg: HoisterResult) => {
    if (seenPkgs.has(srcPkg))
      return;
    seenPkgs.add(srcPkg);

    for (const depPkg of srcPkg.deps) {
      if (!srcPkg.peerNames.has(depPkg.name)) {
        const {name, reference, locator, deps, depNames, hoistedDeps, peerNames, ...meta} = depPkg;
        const pkg: HoisterResult = {name, reference, deps: new Set(), ...meta};
        dstPkg.deps.add(pkg);
        copySubTree(depPkg, pkg);
      }
    }
  };

  copySubTree(tree, treeCopy);

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
const buildAncestorMap = (tree: Package): AncestorMap => {
  const ancestorMap: AncestorMap = new Map();

  const seenPkgs = new Set<Package>();

  const addAncestor = (parentLocators: Locator[], pkg: Package) => {
    if (seenPkgs.has(pkg))
      return;
    seenPkgs.add(pkg);

    for (const depPkg of pkg.deps) {
      let ancestors = ancestorMap.get(depPkg.locator);
      if (!ancestors) {
        ancestors = new Set(parentLocators);
        ancestorMap.set(depPkg.locator, ancestors);
      }

      ancestors.add(pkg.locator);

      addAncestor([...parentLocators, depPkg.locator], depPkg);
    }
  };

  addAncestor([], tree);

  return ancestorMap;
};

const getHoistablePackages = (ancestorMap: AncestorMap, parent: Package, dep: Package, subDeps: Package[], hoistCandidates: Map<string, Package>): Map<string, Package> => {
  const [subDep, ...tail] = subDeps;
  if (!subDep)
    return hoistCandidates;
  let candidates = getHoistablePackages(ancestorMap, parent, dep, tail, hoistCandidates);
  const parentNameLocator = parent.depNames.get(subDep.name);

  // Parent package should have name available for the package to hoist
  const isRegularDep = !dep.peerNames.has(subDep.name);
  const isNameAvailable = isRegularDep && (!parentNameLocator || (parentNameLocator === subDep.locator && !parent.peerNames.has(subDep.name)));
  let isPreferred = isNameAvailable;
  if (isPreferred) {
    const competitorPackage = candidates.get(subDep.name);
    // If there is a competitor package to be hoisted, we should prefer the package with more usage
    isPreferred = !competitorPackage || ancestorMap.get(competitorPackage.locator)!.size < ancestorMap.get(subDep.locator)!.size;
  }

  let areHoistedDepsSatisfied = isPreferred;
  for (const [name, locator] of subDep.hoistedDeps.entries()) {
    if (parent.depNames.get(name) !== locator) {
      areHoistedDepsSatisfied = false;
      break;
    }
  }

  let arePeerDepsSatisfied = areHoistedDepsSatisfied;
  if (arePeerDepsSatisfied) {
    for (const name of subDep.peerNames) {
      if (dep.depNames.has(name)) {
        arePeerDepsSatisfied = false;
        break;
      }
    }
  }

  if (arePeerDepsSatisfied) {
    candidates = new Map(candidates);
    candidates.set(subDep.name, subDep);
  }

  return candidates;
};

/**
 * Performs the hoisting of subdependencies of direct dependency of a parent package.
 *
 * This function mutates package tree.
 *
 * @param ancestorMap ancestor map
 * @param parent parent package
 * @param deps direct dependency of a parent package
 */
const recursiveHoist = (ancestorMap: AncestorMap, parent: Package, deps: Package[]) => {
  const [dep, ...depTail] = deps;
  if (!dep)
    return;
  recursiveHoist(ancestorMap, dep, Array.from(dep.deps));
  recursiveHoist(ancestorMap, parent, depTail);
  // All deps are inherited deps
  if (dep.deps.size === dep.peerNames.size)
    return;

  let packagesToHoist;
  // We need to do multiple passes, because inherited deps might block regular deps at first
  do {
    // Carefull here, we should access dep.deps again, because it might be changed by previous hoisting
    packagesToHoist = getHoistablePackages(ancestorMap, parent, dep, Array.from(dep.deps), new Map());
    for (const pkg of packagesToHoist.values()) {
      if (pkg.name === 'npmlog')
        console.log(parent.locator, dep.locator, pkg.locator, Array.from(pkg.depNames.keys()), pkg.hoistedDeps);
      dep.hoistedDeps.set(pkg.name, pkg.locator);
      dep.deps.delete(pkg);
      dep.depNames.delete(pkg.name);
      // Don't double add the dep that already exists
      if (!parent.depNames.has(pkg.name)) {
        parent.deps.add(pkg);
        parent.depNames.set(pkg.name, pkg.locator);
      }
      // Hoisted package is no longer ancestor of the dep
      ancestorMap.get(pkg.locator)!.delete(dep.locator);
    }
  } while (packagesToHoist.size > 0);
};

/**
 * Hoists package tree.
 *
 * This function does not mutate its arguments, it hoists and returns tree copy
 *
 * @param tree package tree (cycles in the tree are allowed)
 *
 * @returns hoisted tree copy
 */
export const hoist = (inputTree: HoisterTree): HoisterResult => {
  const tree = cloneTree(inputTree);
  const ancestorMap = buildAncestorMap(tree);

  recursiveHoist(ancestorMap, tree, Array.from(tree.deps));

  return shrinkTree(tree);
};
