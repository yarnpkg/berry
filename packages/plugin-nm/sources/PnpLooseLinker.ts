import {LinkOptions, structUtils}                      from '@yarnpkg/core';
import {VirtualFS, ZipOpenFS, ppath, Filename}         from '@yarnpkg/fslib';
import {getLibzipPromise}                              from '@yarnpkg/libzip';
import {NodeModulesPackageNode, buildNodeModulesTree}  from '@yarnpkg/nm';
import {PnpInstaller, PnpLinker}                       from '@yarnpkg/plugin-pnp';
import {PnpSettings, makeRuntimeApi, DependencyTarget} from '@yarnpkg/pnp';

export class PnpLooseLinker extends PnpLinker {
  protected mode = `loose`;

  makeInstaller(opts: LinkOptions) {
    return new PnpLooseInstaller(opts);
  }
}

class PnpLooseInstaller extends PnpInstaller {
  protected mode = `loose`;

  async transformPnpSettings(pnpSettings: PnpSettings) {
    const defaultFsLayer = new VirtualFS({
      baseFs: new ZipOpenFS({
        libzip: await getLibzipPromise(),
        maxOpenFiles: 80,
        readOnlyArchives: true,
      }),
    });

    const pnp = makeRuntimeApi(pnpSettings, this.opts.project.cwd, defaultFsLayer);
    const {tree, errors} = buildNodeModulesTree(pnp, {pnpifyFs: false, project: this.opts.project});
    if (!tree) {
      for (const {messageName, text} of errors)
        this.opts.report.reportError(messageName, text);

      return;
    }

    const fallbackPool = new Map<string, DependencyTarget>();
    pnpSettings.fallbackPool = fallbackPool;

    const registerFallback = (name: string, entry: NodeModulesPackageNode) => {
      const locator = structUtils.parseLocator(entry.locator);
      const identStr = structUtils.stringifyIdent(locator);

      if (identStr === name) {
        fallbackPool.set(name, locator.reference);
      } else {
        fallbackPool.set(name, [identStr, locator.reference]);
      }
    };

    const root = ppath.join(this.opts.project.cwd, Filename.nodeModules);

    const entry = tree.get(root);
    // If there's no root junction point, it means that there are no dependencies to add to the fallback pool
    if (typeof entry === `undefined`)
      return;

    if (`target` in entry)
      throw new Error(`Assertion failed: Expected the root junction point to be a directory`);

    for (const childName of entry.dirList) {
      const childP = ppath.join(root, childName);

      const child = tree.get(childP);
      if (typeof child === `undefined`)
        throw new Error(`Assertion failed: Expected the child to have been registered`);

      if (`target` in child) {
        registerFallback(childName, child);
      } else {
        for (const subChildName of child.dirList) {
          const subChildP = ppath.join(childP, subChildName);

          const subChild = tree.get(subChildP);
          if (typeof subChild === `undefined`)
            throw new Error(`Assertion failed: Expected the subchild to have been registered`);

          if (`target` in subChild) {
            registerFallback(`${childName}/${subChildName}`, subChild);
          } else {
            throw new Error(`Assertion failed: Expected the leaf junction to be a package`);
          }
        }
      }
    }
  }
}
