import {Linker, LinkOptions, MinimalLinkOptions}        from '@berry/core';
import {Locator, Manifest, Package, Project, Workspace} from '@berry/core';
import {structUtils}                                    from '@berry/core';
import {CwdFS, FakeFS}                                  from '@berry/zipfs';

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

        async onPackage({chain, targetFs}: DTTState, locator: Locator, packageFs: FakeFS): Promise<[DTTState, null] | null> {
          if (chain.get(locator.identHash) === locator.locatorHash)
            return null;

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
