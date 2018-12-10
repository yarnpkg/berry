import {Linker, LinkOptions, LinkTree, MinimalLinkOptions} from '@berry/core';
import {Locator, Manifest, Package, Project, Workspace}    from '@berry/core';
import {structUtils}                                       from '@berry/core';
import {CwdFS, FakeFS}                                     from '@berry/zipfs';

type DTTState = {
  chain: Map<string, string>,
  targetFs: FakeFS,
};

export class NodeLinker implements Linker<DTTState> {
  supports(pkg: Package, opts: MinimalLinkOptions) {
    return true;
  }

  async setup(opts: LinkOptions) {
    return {
      dependencyTreeTraversal: {
        hoist(tree: LinkTree): LinkTree {
          divideAndConquer(tree);
          return tree;

          function checkInheritedDependencies(transitiveDependency: LinkTree, directDependency: LinkTree) {
            return true;
          }

          function divideAndConquer(tree: LinkTree) {
            for (const children of tree.children)
              divideAndConquer(children);

            for (const directDependency of Array.from(tree.children)) {
              for (const transitiveDependency of Array.from(directDependency.children)) {
                let availableDependency = tree.children.find(dependency => dependency.locator.identHash === directDependency.locator.identHash);
                const isHoistable = (!availableDependency || availableDependency.locator.locatorHash === directDependency.locator.locatorHash) && checkInheritedDependencies(transitiveDependency, directDependency);

                if (isHoistable && !availableDependency) {
                  tree.children.push(availableDependency = {
                    ... transitiveDependency,
                    hoistedFrom: [],
                    isHardDependency: false,
                  });
                }

                if (isHoistable) {
                  if (!availableDependency)
                    throw new Error(`Assertion failed: the dependency should be available`);

                  availableDependency.hoistedFrom = availableDependency.hoistedFrom.concat(transitiveDependency.hoistedFrom);
                  directDependency.children.splice(directDependency.children.indexOf(transitiveDependency), 1);
                }
              }
            }
          }
        },

        async onRoot(locator: Locator, targetFs: FakeFS | null): Promise<DTTState> {
          if (!targetFs)
            throw new Error(`Assertion failed: this linker cannot be the direct root of a dependency tree`);

          return {chain: new Map(), targetFs};
        },

        async onEdge({chain, targetFs}: DTTState, locator: Locator): Promise<DTTState> {
          const nextTargetPath = `node_modules/${structUtils.requirableIdent(locator)}`;
          const nextTargetFs = new CwdFS(nextTargetPath, {baseFs: targetFs});

          return {targetFs: nextTargetFs, chain};
        },

        async onPackage({chain, targetFs}: DTTState, locator: Locator, packageFs: FakeFS): Promise<[DTTState, null]> {
          await targetFs.mkdirpPromise(`.`);
          await targetFs.copyPromise(`.`, `.`, {baseFs: packageFs});

          const nextChain = new Map(chain);
          nextChain.set(locator.identHash, locator.locatorHash);

          return [{chain: nextChain, targetFs}, null];
        },
      },
    };
  }
}
