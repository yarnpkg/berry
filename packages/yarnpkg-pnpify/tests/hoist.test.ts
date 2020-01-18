import {hoist, HoisterTree, HoisterResult} from '../sources/hoist';

const toTree = (obj: any): HoisterTree => {
  const tree = new Map(
    Object.entries(obj).map(([key, val]: [string, any]) => {
      const {deps, peerNames, ...meta} = val;
      return [key, {
        name: key.match(/@?[^@]+/)![0],
        reference: key.match(/@?[^@]+@?(.+)?/)![1] || '',
        deps: new Set(deps || []),
        peerNames: new Set(peerNames || []),
        ...meta,
      }];
    })
  );
  // Create empty nodes
  for (const node of tree.values()) {
    for (const dep of node.deps) {
      if (!tree.has(dep)) {
        tree.set(dep, {
          name: dep.match(/@?[^@]+/)![0],
          reference: dep.match(/@?[^@]+@?(.+)?/)![1] || '',
          deps: new Set(),
          peerNames: new Set(),
        });
      }
    }
  }
  return tree;
};

const toResult = (obj: any): HoisterResult => {
  const tree = new Map(
    Object.entries(obj).map(([key, val]: [string, any]) => {
      const {deps, peerNames, ...meta} = val;
      return [key, {
        name: key.match(/@?[^@]+/)![0],
        reference: key.match(/@?[^@]+@?([^$]+)?/)![1] || '',
        deps: new Set(deps || []),
        ...meta,
      }];
    })
  );
  // Create empty nodes
  for (const node of tree.values()) {
    for (const dep of node.deps) {
      if (!tree.has(dep)) {
        tree.set(dep, {
          name: dep.match(/@?[^@]+/)![0],
          reference: dep.match(/@?[^@]+@?([^$]+)?/)![1] || '',
          deps: new Set(),
        });
      }
    }
  }
  return tree;
};

describe('hoist', () => {
  it('should do very basic hoisting', () => {
    // . → A → B
    // should be hoisted to:
    // . → A
    //   → B
    const tree = {
      '.': {deps: ['A']},
      'A': {deps: ['B']},
    };
    expect(hoist(toTree(tree))).toEqual(toResult({
      '.': {deps: ['A', 'B']},
    }));
  });

  it('should preserve original metadata during hoisting', () => {
    // . → A → B
    //   → C → B
    // should be hoisted to:
    // . → A
    //   → B
    //   → C
    const tree = {
      '.': {deps: ['A'], meta1: 'dot'},
      'A': {deps: ['B'], meta2: 'abc'},
      'B': {meta3: 'def'},
    };
    expect(hoist(toTree(tree))).toEqual(toResult({
      '.': {deps: ['A', 'B'], meta1: new Set(['dot'])},
      'A': {meta2: new Set(['abc'])},
      'B': {meta3: new Set(['def'])},
    }));
  });

  it('should not hoist different package with the same name', () => {
    // . → A → B@X
    //   → B@Y
    // should not be changed
    const tree = {
      '.': {deps: ['A', 'B@Y']},
      'A': {deps: ['B@X']},
    };
    expect(hoist(toTree(tree))).toEqual(toResult(tree));
  });

  it('should not hoist package that has several versions on the same tree path', () => {
    // . → A → B@X → C → B@Y
    // should be hoisted to:
    // . → A
    //   → B@X
    //   → C → B@Y
    const tree = {
      '.':   {deps: ['A']},
      'A':   {deps: ['B@X']},
      'B@X': {deps: ['C']},
      'C':   {deps: ['B@Y']},
    };
    expect(hoist(toTree(tree))).toEqual(toResult({
      '.': {deps: ['A', 'B@X', 'C']},
      'C': {deps: ['B@Y']},
    }));
  });

  it('should perform deep hoisting', () => {
    // . → A → B@X → C@Y
    //       → C@X
    //   → B@Y
    //   → C@X
    // should be hoisted to:
    // . → A → B@X → C@Y
    //   → B@Y
    //   → C@X
    const tree = {
      '.':   {deps: ['A', 'B@Y', 'C@X']},
      'A':   {deps: ['B@X', 'C@X']},
      'B@X': {deps: ['C@Y']},
      'C':   {deps: ['B@Y']},
    };
    expect(hoist(toTree(tree))).toEqual(toResult({
      '.':   {deps: ['A', 'B@Y', 'C@X']},
      'A':   {deps: ['B@X']},
      'B@X': {deps: ['C@Y']},
    }));
  });

  it('should tolerate self-dependencies', () => {
    // . → . → A → A → B@X → B@X → C@Y
    //               → C@X
    //   → B@Y
    //   → C@X
    // should be hoisted to:
    // . → A → B@X → C@Y
    //   → B@Y
    //   → C@X
    const tree = {
      '.':   {deps: ['.', 'A', 'B@Y', 'C@X']},
      'A':   {deps: ['A', 'B@X', 'C@X']},
      'B@X': {deps: ['B@X', 'C@Y']},
      'C':   {deps: ['B@Y']},
    };
    expect(hoist(toTree(tree))).toEqual(toResult({
      '.':   {deps: ['A', 'B@Y', 'C@X']},
      'A':   {deps: ['B@X']},
      'B@X': {deps: ['C@Y']},
    }));
  });

  it('should honor package popularity when hoisting', () => {
    // . → A → B@X
    //   → C → B@X
    //   → D → B@Y
    //   → E → B@Y
    //   → F → G → B@Y
    // should be hoisted to:
    // . → A → B@X
    //   → C → B@X
    //   → D
    //   → E
    //   → F
    //   → G
    //   → B@Y
    const tree = {
      '.': {deps: ['A', 'C', 'D', 'E', 'F']},
      'A': {deps: ['B@X']},
      'C': {deps: ['B@X']},
      'D': {deps: ['B@Y']},
      'E': {deps: ['B@Y']},
      'F': {deps: ['G']},
      'G': {deps: ['B@Y']},
    };
    expect(hoist(toTree(tree))).toEqual(toResult({
      '.': {deps: ['A', 'C', 'D', 'E', 'F', 'G', 'B@Y']},
      'A': {deps: ['B@X']},
      'C': {deps: ['B@X']},
    }));
  });

  it('should honor peer dependencies', () => {
    // . → A → B ⟶ D@X
    //       → D@X
    //   → D@Y
    // should be hoisted to (A and B should share single D@X dependency):
    // . → A → B
    //     → D@X
    //   → D@Y
    const tree = {
      '.': {deps: ['A', 'D@Y']},
      'A': {deps: ['B', 'D@X']},
      'B': {deps: ['D@X'], peerNames: ['D']},
    };
    expect(hoist(toTree(tree))).toEqual(toResult({
      '.': {deps: ['A', 'D@Y']},
      'A': {deps: ['B', 'D@X']},
    }));
  });

  it('should hoist deps after hoisting peer dep', () => {
    // . → A → B ⟶ D@X
    //     → D@X
    // should be hoisted to (B should be hoisted because its inherited dep D@X was hoisted):
    // . → A
    //   → B
    //   → D@X
    const tree = {
      '.': {deps: ['A']},
      'A': {deps: ['B', 'D@X']},
      'B': {deps: ['D@X'], peerNames: ['D']},
    };
    expect(hoist(toTree(tree))).toEqual(toResult({
      '.': {deps: ['A', 'B', 'D@X']},
    }));
  });

  it('should honor unhoisted peer dependencies', () => {
    // . → A ⟶ B@X
    //     → C@X → B@Y
    //   → B@X
    //   → C@Y
    // should be hoisted to:
    // . → A
    //     → C@X → B@Y
    //   → B@X
    //   → C@Y
    const tree = {
      '.': {deps: ['A', 'B@X', 'C@Y']},
      'A': {deps: ['B@X', 'C@X'], peerNames: ['B']},
      'C@X': {deps: ['B@Y']},
    };
    expect(hoist(toTree(tree))).toEqual(toResult({
      '.': {deps: ['A', 'B@X', 'C@Y']},
      'A': {deps: ['C@X']},
      'C@X': {deps: ['B@Y']},
    }));
  });

  it('should honor peer dependency promise for the same version of dependency', () => {
    // . → A → B → C
    //   ⟶ B
    // should be hoisted to (B must not be hoisted to the top):
    // . → A → B
    //   → C
    const tree = {
      '.': {deps: ['A'], peerNames: ['B']},
      'A': {deps: ['B']},
      'B': {deps: ['C']},
    };
    expect(hoist(toTree(tree))).toEqual(toResult({
      '.': {deps: ['A', 'C']},
      'A': {deps: ['B']},
    }));
  });

  it('should hoist different copies of a package independently', () => {
    // . → A → B@X → C@X
    //     → C@Y
    //   → D → B@X → C@X
    //   → B@Y
    //   → C@Z
    // should be hoisted to (top C@X instance must not be hoisted):
    // . → A → B@X → C@X
    //     → C@Y
    //   → D → B@X
    //     → C@X
    //   → B@Y
    //   → C@Z
    const tree = {
      '.': {deps: ['A', 'D', 'B@Y', 'C@Z']},
      'A': {deps: ['B@X', 'C@Y']},
      'B@X': {deps: ['C@X']},
      'D': {deps: ['B@X']},
    };
    expect(hoist(toTree(tree))).toEqual(toResult({
      '.': {deps: ['A', 'D', 'B@Y', 'C@Z']},
      'A': {deps: ['B@X', 'C@Y']},
      'B@X': {deps: ['C@X']},
      'D': {deps: ['B@X$1', 'C@X']},
    }));
  });

  it('should hoist different copies of a package independently (complicated case)', () => {
    // . → A → B@X → C@X → D@X
    //     → C@Y
    //   → E → B@X → C@X → D@X
    //   → F → G → B@X → C@X → D@X
    //         → D@Z
    //   → B@Y
    //   → D@Y
    //   → C@Z
    // should be hoisted to (top C@X instance must not be hoisted):
    // . → A → B@X → C@X
    //     → C@Y
    //     → D@X
    //   → E → B@X
    //     → C@X
    //     → D@X
    //   → F
    //   → G → B@X
    //     → C@X → D@X
    //     → D@Z
    //   → B@Y
    //   → D@Y
    //   → C@Z
    const tree = {
      '.': {deps: ['A', 'E', 'F', 'B@Y', 'C@Z', 'D@Y']},
      'A': {deps: ['B@X', 'C@Y']},
      'B@X': {deps: ['C@X']},
      'C@X': {deps: ['D@X']},
      'E': {deps: ['B@X']},
      'F': {deps: ['G']},
      'G': {deps: ['B@X', 'D@Z']},
    };
    expect(hoist(toTree(tree))).toEqual(toResult({
      '.': {deps: ['A', 'E', 'F', 'G', 'B@Y', 'D@Y', 'C@Z']},
      'A': {deps: ['B@X', 'C@Y', 'D@X']},
      'B@X': {deps: ['C@X']},
      'E': {deps: ['B@X$1', 'C@X$1', 'D@X']},
      'G': {deps: ['B@X$2', 'C@X$2', 'D@Z']},
      'C@X$2': {deps: ['D@X']},
    }));
  });
});
