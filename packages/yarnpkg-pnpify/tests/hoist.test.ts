import {hoist, HoisterTree} from '../sources/hoist';

const toTree = (obj: any, key: string = '.', nodes = new Map()): HoisterTree => {
  let node = nodes.get(key);
  if (!node) {
    node = {
      name: key.match(/@?[^@]+/)![0],
      reference: key.match(/@?[^@]+@?(.+)?/)![1] || '',
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

describe('hoist', () => {
  it('should do very basic hoisting', () => {
    // . -> A -> B
    // should be hoisted to:
    // . -> A
    //   -> B
    const tree = {
      '.': {dependencies: ['A']},
      'A': {dependencies: ['B']},
    };
    hoist(toTree(tree), {check: true});
  });

  it('should support basic cyclic dependencies', () => {
    // . -> A -> B -> A
    // should be hoisted to:
    // . -> A
    //   -> B
    const tree = {
      '.': {dependencies: ['A']},
      'A': {dependencies: ['B']},
      'B': {dependencies: ['A']},
    };
    hoist(toTree(tree), {check: true});
  });

  it('should keep require promise', () => {
    // . -> A -> B -> C@X -> D@X
    //             -> F@X -> G@X
    //        -> C@Z
    //        -> F@Z
    //   -> C@Y
    //   -> D@Y
    // should be hoisted to (B cannot be hoisted to the top, othewise C@X will access D@Y instead of D@X):
    // . -> A -> B -> C@X
    //             -> F@X
    //        -> C@Z
    //        -> D@X
    //   -> C@Y
    //   -> D@Y
    //   -> F@Z
    //   -> G@X
    const tree = {
      '.': {dependencies: ['A', 'C@Y', 'D@Y']},
      'A': {dependencies: ['B', 'C@Z', 'F@Z']},
      'B': {dependencies: ['C@X', 'F@X']},
      'F@X': {dependencies: ['G@X']},
      'C@X': {dependencies: ['D@X']},
    };
    hoist(toTree(tree), {check: true});
  });

  it('should not forget hoisted dependencies', () => {
    // . -> A -> B -> C@X
    //             -> A
    //   -> C@Y
    // should be hoisted to (B cannot be hoisted to the top, otherwise it will require C@Y instead of C@X)
    // . -> A -> B
    //        -> C@X
    //   -> C@Y
    const tree = {
      '.': {dependencies: ['A', 'C@Y']},
      'A': {dependencies: ['B']},
      'B': {dependencies: ['A', 'C@X']},
    };
    hoist(toTree(tree), {check: true});
  });

  it('should not hoist different package with the same name', () => {
    // . -> A -> B@X
    //   -> B@Y
    // should not be changed
    const tree = {
      '.': {dependencies: ['A', 'B@Y']},
      'A': {dependencies: ['B@X']},
    };
    hoist(toTree(tree), {check: true});
  });

  it('should not hoist package that has several versions on the same tree path', () => {
    // . -> A -> B@X -> C -> B@Y
    // should be hoisted to:
    // . -> A
    //   -> B@X
    //   -> C -> B@Y
    const tree = {
      '.':   {dependencies: ['A']},
      'A':   {dependencies: ['B@X']},
      'B@X': {dependencies: ['C']},
      'C':   {dependencies: ['B@Y']},
    };
    hoist(toTree(tree), {check: true});
  });

  it('should perform deep hoisting', () => {
    // . -> A -> B@X -> C@Y
    //        -> C@X
    //   -> B@Y
    //   -> C@X
    // should be hoisted to:
    // . -> A -> B@X -> C@Y
    //   -> B@Y
    //   -> C@X
    const tree = {
      '.':   {dependencies: ['A', 'B@Y', 'C@X']},
      'A':   {dependencies: ['B@X', 'C@X']},
      'B@X': {dependencies: ['C@Y']},
      'C':   {dependencies: ['B@Y']},
    };
    hoist(toTree(tree), {check: true});
  });

  it('should tolerate self-dependencies', () => {
    // . -> . -> A -> A -> B@X -> B@X -> C@Y
    //                  -> C@X
    //   -> B@Y
    //   -> C@X
    // should be hoisted to:
    // . -> A -> B@X -> C@Y
    //   -> B@Y
    //   -> C@X
    const tree = {
      '.':   {dependencies: ['.', 'A', 'B@Y', 'C@X']},
      'A':   {dependencies: ['A', 'B@X', 'C@X']},
      'B@X': {dependencies: ['B@X', 'C@Y']},
      'C':   {dependencies: ['B@Y']},
    };
    hoist(toTree(tree), {check: true});
  });

  it('should honor package popularity when hoisting', () => {
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
      '.': {dependencies: ['A', 'C', 'D', 'E', 'F']},
      'A': {dependencies: ['B@X']},
      'C': {dependencies: ['B@X']},
      'D': {dependencies: ['B@Y']},
      'E': {dependencies: ['B@Y']},
      'F': {dependencies: ['G']},
      'G': {dependencies: ['B@Y']},
    };
    hoist(toTree(tree), {check: true});
  });

  it('should honor peer dependencies', () => {
    // . -> A -> B --> D@X
    //        -> D@X
    //   -> D@Y
    // should be hoisted to (A and B should share single D@X dependency):
    // . -> A -> B
    //        -> D@X
    //   -> D@Y
    const tree = {
      '.': {dependencies: ['A', 'D@Y']},
      'A': {dependencies: ['B', 'D@X']},
      'B': {dependencies: ['D@X'], peerNames: ['D']},
    };
    hoist(toTree(tree), {check: true});
  });

  it('should hoist dependencies after hoisting peer dep', () => {
    // . -> A -> B --> D@X
    //      -> D@X
    // should be hoisted to (B should be hoisted because its inherited dep D@X was hoisted):
    // . -> A
    //   -> B
    //   -> D@X
    const tree = {
      '.': {dependencies: ['A']},
      'A': {dependencies: ['B', 'D@X']},
      'B': {dependencies: ['D@X'], peerNames: ['D']},
    };
    hoist(toTree(tree), {check: true});
  });

  it('should honor unhoisted peer dependencies', () => {
    // . -> A --> B@X
    //        -> C@X -> B@Y
    //   -> B@X
    //   -> C@Y
    // should be hoisted to:
    // . -> A -> C@X -> B@Y
    //   -> B@X
    //   -> C@Y
    const tree = {
      '.': {dependencies: ['A', 'B@X', 'C@Y']},
      'A': {dependencies: ['B@X', 'C@X'], peerNames: ['B']},
      'C@X': {dependencies: ['B@Y']},
    };
    hoist(toTree(tree), {check: true});
  });

  it('should honor peer dependency promise for the same version of dependency', () => {
    // . -> A -> B -> C
    //   --> B
    // should be hoisted to (B must not be hoisted to the top):
    // . -> A -> B
    //   -> C
    const tree = {
      '.': {dependencies: ['A'], peerNames: ['B']},
      'A': {dependencies: ['B']},
      'B': {dependencies: ['C']},
    };
    hoist(toTree(tree), {check: true});
  });

  it('should hoist different copies of a package independently', () => {
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
      '.': {dependencies: ['A', 'D', 'B@Y', 'C@Z']},
      'A': {dependencies: ['B@X', 'C@Y']},
      'B@X': {dependencies: ['C@X']},
      'D': {dependencies: ['B@X']},
    };
    hoist(toTree(tree), {check: true});
  });

  it('should hoist different copies of a package independently (complicated case)', () => {
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
      '.': {dependencies: ['A', 'E', 'F', 'B@Y', 'C@Z', 'D@Y']},
      'A': {dependencies: ['B@X', 'C@Y']},
      'B@X': {dependencies: ['C@X']},
      'C@X': {dependencies: ['D@X']},
      'E': {dependencies: ['B@X']},
      'F': {dependencies: ['G']},
      'G': {dependencies: ['B@X', 'D@Z']},
    };
    hoist(toTree(tree), {check: true});
  });
});
