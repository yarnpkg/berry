import {RawHoister, PackageTree} from '../sources/RawHoister';

const sortAndTrim = (tree: PackageTree): PackageTree =>
  // Sort deps of each node
  tree.map(deps => deps ? new Set(Array.from(deps).sort()) : deps)
    // Cut off all tail undefined nodes
    .slice(0, tree.length - tree.reverse().findIndex(x => x));

describe('RawHoister', () => {
  const hoister = new RawHoister();

  it('should be able to hoist empty tree', () => {
    expect(hoister.hoist([], [])).toEqual([]);
    expect(hoister.hoist([new Set()], [])).toEqual([new Set()]);
  });

  it('should do very basic hoisting', () => {
    const tree = [
      new Set([1]),
      new Set([2]),
    ];
    const packages = [
      {name: 'app', weight: 1},
      {name: 'webpack', weight: 1},
      {name: 'watchpack', weight: 1},
    ];
    const result = hoister.hoist(tree, packages);
    expect(sortAndTrim(result)).toEqual([
      new Set([1, 2]),
    ]);
  });

  it('should not hoist different package with the same name', () => {
    const tree = [
      new Set([1, 3]),
      new Set([2]),
    ];
    const packages = [
      {name: 'app', weight: 1},
      {name: 'webpack', weight: 1},
      {name: 'watchpack', weight: 1},
      {name: 'watchpack', weight: 1},
    ];
    const result = hoister.hoist(tree, packages);
    expect(sortAndTrim(result)).toEqual([
      new Set([1, 3]),
      new Set([2])]
    );
  });

  it('should not hoist package that has several versions on the same tree path', () => {
    // . → A → B@X → C → B@Y, B@Y should not be hoisted
    const tree = [
      new Set([1]),
      new Set([2]),
      new Set([3]),
      new Set([4]),
    ];
    const packages = [
      {name: 'R', weight: 1},
      {name: 'A', weight: 1},
      {name: 'B', weight: 1},
      {name: 'C', weight: 1},
      {name: 'B', weight: 100},
    ];
    const result = hoister.hoist(tree, packages);
    expect(sortAndTrim(result)).toEqual([
      new Set([1, 2, 3]),
      undefined,
      undefined,
      new Set([4]),
    ]);
  });

  it('should perform deep hoisting', () => {
    const tree = [
      new Set([1, 3, 4]),
      new Set([2, 4]),
      new Set([5]),
    ];
    const packages = [
      {name: 'app', weight: 1},
      {name: 'webpack', weight: 1},
      {name: 'watchpack', weight: 1},
      {name: 'watchpack', weight: 1},
      {name: 'lodash', weight: 1},
      {name: 'lodash', weight: 1},
    ];
    const result = hoister.hoist(tree, packages);
    expect(sortAndTrim(result)).toEqual([
      new Set([1, 3, 4]),
      new Set([2, 5]),
    ]);
  });

  it('should tolerate any cyclic dependencies', () => {
    const tree = [
      new Set([0, 1, 3, 4]),
      new Set([1, 2, 4]),
      new Set([2, 5]),
    ];
    const packages = [
      {name: 'app', weight: 1},
      {name: 'webpack', weight: 1},
      {name: 'watchpack', weight: 1},
      {name: 'watchpack', weight: 1},
      {name: 'lodash', weight: 1},
      {name: 'lodash', weight: 1},
    ];
    const result = hoister.hoist(tree, packages);
    expect(sortAndTrim(result)).toEqual([
      new Set([0, 1, 3, 4]),
      new Set([2, 5]),
    ]);
  });

  it('should honor weight when hoisting', () => {
    const tree = [
      new Set([1]),
      new Set([2, 3, 5]),
      new Set([4]),
      undefined,
      undefined,
      new Set([4]),
    ];
    const packages = [
      {name: 'app', weight: 1},
      {name: 'webpack', weight: 1},
      {name: 'watchpack', weight: 1},
      {name: 'lodash', weight: 3},
      {name: 'lodash', weight: 1},
      {name: 'enhanced-resolve', weight: 1},
    ];
    const result = hoister.hoist(tree, packages);
    expect(sortAndTrim(result)).toEqual([
      new Set([1, 2, 3, 5]),
      undefined,
      new Set([4]),
      undefined,
      undefined,
      new Set([4]),
    ]);
  });
});
