import {PortablePath}              from '@yarnpkg/fslib';
import {PnpApi}                    from '@yarnpkg/pnp';

import {LinkType, NodeModulesTree} from '../sources/buildNodeModulesTree';
import {buildPackageMap}           from '../sources';

describe(`buildPackageMap`, () => {
  it(`should generate one package map entry for each node_modules package node`, () => {
    const tree: NodeModulesTree = new Map([
      [`/project` as PortablePath, {
        locator: `root@workspace:.`,
        target: `/project` as PortablePath,
        linkType: LinkType.SOFT,
        nodePath: ``,
        aliases: [],
      }],
      [`/project/node_modules/foo` as PortablePath, {
        locator: `foo@npm:1.0.0`,
        target: `/cache/foo` as PortablePath,
        linkType: LinkType.HARD,
        nodePath: `/foo`,
        aliases: [],
      }],
      [`/project/node_modules/bar` as PortablePath, {
        locator: `bar@npm:1.0.0`,
        target: `/cache/bar` as PortablePath,
        linkType: LinkType.HARD,
        nodePath: `/bar`,
        aliases: [],
      }],
      [`/project/node_modules/foo/node_modules/baz` as PortablePath, {
        locator: `baz@npm:1.0.0`,
        target: `/cache/baz` as PortablePath,
        linkType: LinkType.HARD,
        nodePath: `/foo/baz`,
        aliases: [],
      }],
      [`/project/packages/workspace/node_modules/foo` as PortablePath, {
        locator: `foo@npm:1.0.0`,
        target: `/cache/foo` as PortablePath,
        linkType: LinkType.HARD,
        nodePath: `/workspace/foo`,
        aliases: [],
      }],
    ]);

    const pnp = {
      getPackageInformation: ({name, reference}: {name: string, reference: string}) => {
        const packageDependencies = new Map<string, string | null>();

        if (`${name}@${reference}` === `root@workspace:.`) {
          packageDependencies.set(`bar`, `npm:1.0.0`);
          packageDependencies.set(`foo`, `npm:1.0.0`);
        }

        if (`${name}@${reference}` === `foo@npm:1.0.0`)
          packageDependencies.set(`baz`, `npm:1.0.0`);

        return {packageDependencies};
      },
    } as unknown as PnpApi;

    expect(buildPackageMap(tree, {basePath: `/project/node_modules` as PortablePath, pnp})).toEqual({
      packages: {
        '.': {
          url: `..`,
          dependencies: {
            bar: `bar`,
            foo: `foo`,
          },
        },
        '../packages/workspace/node_modules/foo': {
          url: `../packages/workspace/node_modules/foo`,
          dependencies: {},
        },
        bar: {
          url: `./bar`,
          dependencies: {},
        },
        foo: {
          url: `./foo`,
          dependencies: {
            baz: `foo/node_modules/baz`,
          },
        },
        'foo/node_modules/baz': {
          url: `./foo/node_modules/baz`,
          dependencies: {},
        },
      },
    });
  });

  it(`should generate loose package dependencies from node_modules hoisting`, () => {
    const tree: NodeModulesTree = new Map([
      [`/project` as PortablePath, {
        locator: `root@workspace:.`,
        target: `/project` as PortablePath,
        linkType: LinkType.SOFT,
        nodePath: ``,
        aliases: [],
      }],
      [`/project/node_modules/foo` as PortablePath, {
        locator: `foo@npm:1.0.0`,
        target: `/cache/foo` as PortablePath,
        linkType: LinkType.HARD,
        nodePath: `/foo`,
        aliases: [],
      }],
      [`/project/node_modules/bar` as PortablePath, {
        locator: `bar@npm:1.0.0`,
        target: `/cache/bar` as PortablePath,
        linkType: LinkType.HARD,
        nodePath: `/bar`,
        aliases: [],
      }],
      [`/project/node_modules/foo/node_modules/baz` as PortablePath, {
        locator: `baz@npm:1.0.0`,
        target: `/cache/baz` as PortablePath,
        linkType: LinkType.HARD,
        nodePath: `/foo/baz`,
        aliases: [],
      }],
      [`/project/packages/workspace/node_modules/foo` as PortablePath, {
        locator: `foo@npm:1.0.0`,
        target: `/cache/foo` as PortablePath,
        linkType: LinkType.HARD,
        nodePath: `/workspace/foo`,
        aliases: [],
      }],
    ]);

    expect(buildPackageMap(tree, {basePath: `/project/node_modules` as PortablePath, pnp: null})).toEqual({
      packages: {
        '.': {
          url: `..`,
          dependencies: {
            bar: `bar`,
            foo: `foo`,
          },
        },
        '../packages/workspace/node_modules/foo': {
          url: `../packages/workspace/node_modules/foo`,
          dependencies: {
            bar: `bar`,
            foo: `../packages/workspace/node_modules/foo`,
          },
        },
        bar: {
          url: `./bar`,
          dependencies: {
            bar: `bar`,
            foo: `foo`,
          },
        },
        foo: {
          url: `./foo`,
          dependencies: {
            bar: `bar`,
            baz: `foo/node_modules/baz`,
            foo: `foo`,
          },
        },
        'foo/node_modules/baz': {
          url: `./foo/node_modules/baz`,
          dependencies: {
            bar: `bar`,
            baz: `foo/node_modules/baz`,
            foo: `foo`,
          },
        },
      },
    });
  });
});
