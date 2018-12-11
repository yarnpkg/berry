import {Linker, LinkOptions, LinkTree, MinimalLinkOptions} from '@berry/core';
import {Locator, Manifest, Package, Project, Workspace}    from '@berry/core';
import {structUtils}                                       from '@berry/core';
import {CwdFS, FakeFS}                                     from '@berry/zipfs';

type DTTState = {
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
            for (const identHash of transitiveDependency.inheritedDependencies)
              if (directDependency.children.find(children => children.locator.identHash === identHash))
                return false;

            return true;
          }

          function divideAndConquer(tree: LinkTree) {
            for (const children of tree.children)
              divideAndConquer(children);

            for (const directDependency of Array.from(tree.children)) {
              for (const transitiveDependency of Array.from(directDependency.children)) {
                // If the transitive dependency depends on a dependency provided by
                // its immediate parent, then it cannot be hoisted above its parent
                if (!checkInheritedDependencies(transitiveDependency, directDependency))
                  continue;

                // We only allow the hoister to hoist packages that have the
                // exact same locator (the reasoning is that any optimization
                // such as merging two overlapping semver ranges should have
                // been done ahead of time, during the resolution. Doing it
                // here would require the linker to have a business logic of
                // what even is "semver", and we want to avoid this to keep
                // it as pure as possible).
                //
                // NOTE: If we want to do this later, the best way is to make
                // the resolver a required linker option (similar to how the
                // fetcher is a required resolver option) and add a new member
                // to the Resolver interface that would be tasked of saying
                // whether a specified locator is compatible with a specified
                // descriptor. The main issue is that the LinkTree currently
                // doesn't contain the descriptors (only the full resolved
                // locators), so it would have to be reworked.
                //
                // NOTE (bis): Even when doing this, it would still have other
                // issues. In particular, the dependencies of the package to
                // merge would be hoisted, but then the package to merge would
                // be merged and removed from the tree - but its dependencies
                // wouldn't, having been hoisted. This case cannot happen under
                // the current circumstances, because we are guaranteed that
                // two packages with the same locators have exactly the same set
                // of dependencies no matter what (even if they have peer
                // dependencies, because they'll have been transformed into
                // virtual packages).
                const availableDependency = tree.children.find(dependency => structUtils.areIdentsEqual(dependency.locator, transitiveDependency.locator));
                if (availableDependency && !structUtils.areLocatorsEqual(availableDependency.locator, transitiveDependency.locator))
                  continue;

                // If the previous test passed, then the transitive dependency
                // can be successfully hoisted! In which case we remove it from
                // its parent.
                directDependency.children.splice(directDependency.children.indexOf(transitiveDependency), 1);

                // If there already is a strictly identical locator, then we can
                // entirely prune the transitive branch from the tree.
                if (availableDependency)
                  continue;

                tree.children.push(transitiveDependency);

                if (transitiveDependency.isHardDependency)
                  transitiveDependency.hoistedFrom.push(directDependency);

                transitiveDependency.isHardDependency = false;
              }
            }
          }
        },

        async onRoot(locator: Locator, targetFs: FakeFS): Promise<DTTState> {
          if (!targetFs)
            throw new Error(`Assertion failed: this linker cannot be the direct root of a dependency tree`);

          return {targetFs};
        },

        async onPackage({targetFs: parentFs}: DTTState, locator: Locator, packageFs: FakeFS): Promise<[DTTState, null]> {
          if (!parentFs)
            throw new Error(`Foo`);
          const targetPath = `node_modules/${structUtils.requirableIdent(locator)}`;
          const targetFs = new CwdFS(targetPath, {baseFs: parentFs});

          await targetFs.mkdirpPromise(`.`);
          await targetFs.copyPromise(`.`, `.`, {baseFs: packageFs});

          return [{targetFs}, null];
        },
      },
    };
  }
}
