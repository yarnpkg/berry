import {hoist, HoisterTree, HoisterResult} from '../sources/hoist';

const toTree = (obj: any, key: string = `.`, nodes = new Map()): HoisterTree => {
  let node = nodes.get(key);
  const identName = key.match(/@?[^@]+/)![0];
  if (!node) {
    node = {
      name: identName,
      identName,
      reference: key.match(/@?[^@]+@?(.+)?/)![1] || ``,
      dependencies: new Set<HoisterTree>(),
      peerNames: new Set<string>((obj[key] || {}).peerNames || []),
    };
    nodes.set(key, node);

    for (const dep of ((obj[key] || {}).dependencies || [])) {
      node.dependencies.add(toTree(obj, dep, nodes));
    }
  }
  return node;
};

const getTreeHeight = (tree: HoisterResult): number => {
  let height = 0;
  let maxHeight = 0;
  const seen = new Set<HoisterResult>();

  const visitNode = (node: HoisterResult) => {
    if (seen.has(node))
      return;
    seen.add(node);

    height += 1;
    maxHeight = Math.max(height, maxHeight);
    for (const dep of node.dependencies)
      visitNode(dep);
    height -= 1;
  };

  visitNode(tree);

  return maxHeight;
};

describe(`hoist`, () => {
  it(`should do very basic hoisting`, () => {
    // . -> A -> B
    // should be hoisted to:
    // . -> A
    //   -> B
    const tree = {
      '.': {dependencies: [`A`]},
      A: {dependencies: [`B`]},
    };
    expect(getTreeHeight(hoist(toTree(tree), {check: true}))).toEqual(2);
  });

  it(`should support basic cyclic dependencies`, () => {
    // . -> C -> A -> B -> A
    //             -> D -> E
    // should be hoisted to:
    // . -> A
    //   -> B
    //   -> C
    //   -> D
    //   -> E
    const tree = {
      '.': {dependencies: [`C`]},
      C: {dependencies: [`A`]},
      A: {dependencies: [`B`, `D`]},
      B: {dependencies: [`A`, `E`]},
    };
    expect(getTreeHeight(hoist(toTree(tree), {check: true}))).toEqual(2);
  });

  // it(`should support simple cyclic peer dependencies`, () => {
  //   //   -> D -> A --> B
  //   //        -> B --> C
  //   //        -> C --> A
  //   // Ideally should be hoisted to:
  //   //   -> D
  //   //   -> A
  //   //   -> B
  //   //   -> C
  //   // but its difficult and its okay if hoister at least doesn't loop and leave the graph in original state

  //   const tree = {
  //     '.': {dependencies: [`D`]},
  //     D: {dependencies: [`A`, `B`, `C`]},
  //     A: {dependencies: [`B`], peerNames: [`B`]},
  //     B: {dependencies: [`C`], peerNames: [`C`]},
  //     C: {dependencies: [`A`], peerNames: [`A`]},
  //   };
  //   expect(getTreeHeight(hoist(toTree(tree), {check: true}))).toEqual(3);
  // });

  it(`should support cyclic peer dependencies`, () => {
    // . -> E@X
    //   -> D -> A --> B
    //        -> B --> C
    //        -> C --> A
    //             --> E@Y
    //        -> E@Y
    // Should be hoisted to:
    // . -> E@X
    //   -> D -> A
    //        -> B
    //        -> C
    //        -> E@Y
    const tree = {
      '.': {dependencies: [`D`, `E@X`]},
      D: {dependencies: [`A`, `B`, `C`, `E@Y`]},
      A: {dependencies: [`B`], peerNames: [`B`]},
      B: {dependencies: [`C`], peerNames: [`C`]},
      C: {dependencies: [`A`, `E@Y`], peerNames: [`A`, `E`]},
    };
    expect(getTreeHeight(hoist(toTree(tree), {check: true}))).toEqual(3);
  });

  it(`should keep require promise`, () => {
    // . -> A -> B -> C@X -> D@X
    //             -> F@X -> G@X
    //        -> C@Z
    //        -> F@Z
    //   -> C@Y
    //   -> D@Y
    // should be hoisted to:
    // . -> A
    //        -> C@Z
    //        -> D@X
    //   -> B -> C@X
    //        -> F@X
    //   -> C@Y
    //   -> D@Y
    //   -> F@Z
    //   -> G@X
    const tree = {
      '.': {dependencies: [`A`, `C@Y`, `D@Y`]},
      A: {dependencies: [`B`, `C@Z`, `F@Z`]},
      B: {dependencies: [`C@X`, `F@X`]},
      'F@X': {dependencies: [`G@X`]},
      'C@X': {dependencies: [`D@X`]},
    };
    expect(getTreeHeight(hoist(toTree(tree), {check: true}))).toEqual(3);
  });

  it(`should not forget hoisted dependencies`, () => {
    // . -> A -> B -> C@X
    //             -> A
    //   -> C@Y
    // should be hoisted to (B cannot be hoisted to the top, otherwise it will require C@Y instead of C@X)
    // . -> A -> B
    //        -> C@X
    //   -> C@Y
    const tree = {
      '.': {dependencies: [`A`, `C@Y`]},
      A: {dependencies: [`B`]},
      B: {dependencies: [`A`, `C@X`]},
    };
    expect(getTreeHeight(hoist(toTree(tree), {check: true}))).toEqual(3);
  });

  it(`should not hoist different package with the same name`, () => {
    // . -> A -> B@X
    //   -> B@Y
    // should not be changed
    const tree = {
      '.': {dependencies: [`A`, `B@Y`]},
      A: {dependencies: [`B@X`]},
    };
    expect(getTreeHeight(hoist(toTree(tree), {check: true}))).toEqual(3);
  });

  it(`should not hoist package that has several versions on the same tree path`, () => {
    // . -> A -> B@X -> C -> B@Y
    // should be hoisted to:
    // . -> A
    //   -> B@X
    //   -> C -> B@Y
    const tree = {
      '.':   {dependencies: [`A`]},
      A:   {dependencies: [`B@X`]},
      'B@X': {dependencies: [`C`]},
      C:   {dependencies: [`B@Y`]},
    };
    expect(getTreeHeight(hoist(toTree(tree), {check: true}))).toEqual(3);
  });

  it(`should perform deep hoisting`, () => {
    // . -> A -> B@X -> C@Y
    //        -> C@X
    //   -> B@Y
    //   -> C@X
    // should be hoisted to:
    // . -> A -> B@X -> C@Y
    //   -> B@Y
    //   -> C@X
    const tree = {
      '.':   {dependencies: [`A`, `B@Y`, `C@X`]},
      A:   {dependencies: [`B@X`, `C@X`]},
      'B@X': {dependencies: [`C@Y`]},
      C:   {dependencies: [`B@Y`]},
    };
    expect(getTreeHeight(hoist(toTree(tree), {check: true}))).toEqual(4);
  });

  it(`should tolerate self-dependencies`, () => {
    // . -> . -> A -> A -> B@X -> B@X -> C@Y
    //                  -> C@X
    //   -> B@Y
    //   -> C@X
    // should be hoisted to:
    // . -> A -> B@X -> C@Y
    //   -> B@Y
    //   -> C@X
    const tree = {
      '.':   {dependencies: [`.`, `A`, `B@Y`, `C@X`]},
      A:   {dependencies: [`A`, `B@X`, `C@X`]},
      'B@X': {dependencies: [`B@X`, `C@Y`]},
      C:   {dependencies: [`B@Y`]},
    };
    expect(getTreeHeight(hoist(toTree(tree), {check: true}))).toEqual(4);
  });

  it(`should honor package popularity when hoisting`, () => {
    // . -> A -> B@X
    //   -> C -> B@X
    //   -> D -> B@Y
    //   -> E -> B@Y
    //   -> F -> G -> B@Y
    // should be hoisted to:
    // . -> A -> B@X
    //   -> C -> B@X
    //   -> D
    //   -> E
    //   -> F
    //   -> G
    //   -> B@Y
    const tree = {
      '.': {dependencies: [`A`, `C`, `D`, `E`, `F`]},
      A: {dependencies: [`B@X`]},
      C: {dependencies: [`B@X`]},
      D: {dependencies: [`B@Y`]},
      E: {dependencies: [`B@Y`]},
      F: {dependencies: [`G`]},
      G: {dependencies: [`B@Y`]},
    };
    expect(getTreeHeight(hoist(toTree(tree), {check: true}))).toEqual(3);
  });

  it(`should honor peer dependencies`, () => {
    // . -> A -> B --> D@X
    //        -> D@X
    //   -> D@Y
    // should be hoisted to (A and B should share single D@X dependency):
    // . -> A -> B
    //        -> D@X
    //   -> D@Y
    const tree = {
      '.': {dependencies: [`A`, `D@Y`]},
      A: {dependencies: [`B`, `D@X`]},
      B: {dependencies: [`D@X`], peerNames: [`D`]},
    };
    expect(getTreeHeight(hoist(toTree(tree), {check: true}))).toEqual(3);
  });

  it(`should hoist dependencies after hoisting peer dep`, () => {
    // . -> A -> B --> D@X
    //      -> D@X
    // should be hoisted to (B should be hoisted because its inherited dep D@X was hoisted):
    // . -> A
    //   -> B
    //   -> D@X
    const tree = {
      '.': {dependencies: [`A`]},
      A: {dependencies: [`B`, `D@X`]},
      B: {dependencies: [`D@X`], peerNames: [`D`]},
    };
    expect(getTreeHeight(hoist(toTree(tree), {check: true}))).toEqual(2);
  });

  it(`should honor unhoisted peer dependencies`, () => {
    // . -> A --> B@X
    //        -> C@X -> B@Y
    //   -> B@X
    //   -> C@Y
    // should be hoisted to:
    // . -> A -> C@X -> B@Y
    //   -> B@X
    //   -> C@Y
    const tree = {
      '.': {dependencies: [`A`, `B@X`, `C@Y`]},
      A: {dependencies: [`B@X`, `C@X`], peerNames: [`B`]},
      'C@X': {dependencies: [`B@Y`]},
    };
    expect(getTreeHeight(hoist(toTree(tree), {check: true}))).toEqual(4);
  });

  it(`should honor peer dependency promise for the same version of dependency`, () => {
    // . -> A -> B -> C
    //   --> B
    // should be hoisted to (B must not be hoisted to the top):
    // . -> A -> B
    //   -> C
    const tree = {
      '.': {dependencies: [`A`], peerNames: [`B`]},
      A: {dependencies: [`B`]},
      B: {dependencies: [`C`]},
    };
    expect(getTreeHeight(hoist(toTree(tree), {check: true}))).toEqual(3);
  });

  it(`should hoist different copies of a package independently`, () => {
    // . -> A -> B@X -> C@X
    //        -> C@Y
    //   -> D -> B@X -> C@X
    //   -> B@Y
    //   -> C@Z
    // should be hoisted to (top C@X instance must not be hoisted):
    // . -> A -> B@X -> C@X
    //        -> C@Y
    //   -> D -> B@X
    //        -> C@X
    //   -> B@Y
    //   -> C@Z
    const tree = {
      '.': {dependencies: [`A`, `D`, `B@Y`, `C@Z`]},
      A: {dependencies: [`B@X`, `C@Y`]},
      'B@X': {dependencies: [`C@X`]},
      D: {dependencies: [`B@X`]},
    };
    expect(getTreeHeight(hoist(toTree(tree), {check: true}))).toEqual(4);
  });

  it(`should hoist different copies of a package independently (complicated case)`, () => {
    // . -> A -> B@X -> C@X -> D@X
    //        -> C@Y
    //   -> E -> B@X -> C@X -> D@X
    //   -> F -> G -> B@X -> C@X -> D@X
    //             -> D@Z
    //   -> B@Y
    //   -> D@Y
    //   -> C@Z
    // should be hoisted to (top C@X instance must not be hoisted):
    // . -> A -> B@X →->C@X
    //        -> C@Y
    //        -> D@X
    //   -> E -> B@X
    //        -> C@X
    //        -> D@X
    //   -> F -> B@X -> D@X
    //        -> C@X
    //        -> D@Z
    //   -> B@Y
    //   -> D@Y
    //   -> C@Z
    const tree = {
      '.': {dependencies: [`A`, `E`, `F`, `B@Y`, `C@Z`, `D@Y`]},
      A: {dependencies: [`B@X`, `C@Y`]},
      'B@X': {dependencies: [`C@X`]},
      'C@X': {dependencies: [`D@X`]},
      E: {dependencies: [`B@X`]},
      F: {dependencies: [`G`]},
      G: {dependencies: [`B@X`, `D@Z`]},
    };
    expect(getTreeHeight(hoist(toTree(tree), {check: true}))).toEqual(4);
  });

  it(`should keep peer dependency promise for the case where the package with same ident is a dependency of parent node`, () => {
    // . -> A -> B@X --> C
    //        -> C@Y
    //   -> B@X --> C
    //   -> C@X
    // B@X cannot be hoisted to the top from A, because its peer dependency promise will be violated in this case
    // `npm` and `yarn v1` will hoist B@X to the top, they have incorrect hoisting
    const tree = {
      '.': {dependencies: [`A`, `B@X#2`, `C@X`]},
      A: {dependencies: [`B@X#1`, `C@Y`]},
      'B@X#1': {dependencies: [`C@Y`], peerNames: [`C`]},
      'B@X#2': {dependencies: [`C@X`], peerNames: [`C`]},
    };
    const hoistedTree = hoist(toTree(tree), {check: true});
    const [A] = Array.from(hoistedTree.dependencies).filter(x => x.name === `A`);
    expect(Array.from(A.dependencies).filter(x => x.name === `B`)).toBeDefined();
  });
});
