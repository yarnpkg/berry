import {PortablePath}              from '@yarnpkg/fslib';

import {buildLocatorMap, LinkType} from '../sources/buildNodeModulesTree';
import {NodeModulesTree}           from '../sources/buildNodeModulesTree';

describe(`buildLocatorMap`, () => {
  it.each([false, true])(`should merge aliases across locations (reverse: %s)`, reverse => {
    const locator = `foo@virtual:canonical#npm:1.0.0`;
    const aliases = [[], [`virtual:a#npm:1.0.0`, `virtual:shared#npm:1.0.0`], [`virtual:shared#npm:1.0.0`, `virtual:b#npm:1.0.0`]];
    const originalAliases = aliases.map(value => [...value]);
    const tree: NodeModulesTree = new Map();

    for (const [index, value] of (reverse ? [...aliases].reverse() : aliases).entries()) {
      tree.set(`/project/workspace${index}/node_modules/foo` as PortablePath, {
        locator,
        target: `/cache/foo` as PortablePath,
        linkType: LinkType.HARD,
        nodePath: `/foo`,
        aliases: value,
      });
    }

    const entry = buildLocatorMap(tree).get(locator)!;

    expect([...entry.aliases].sort()).toEqual([`virtual:a#npm:1.0.0`, `virtual:b#npm:1.0.0`, `virtual:shared#npm:1.0.0`]);
    expect(entry.locations).toHaveLength(3);
    expect(aliases).toEqual(originalAliases);
  });
});
