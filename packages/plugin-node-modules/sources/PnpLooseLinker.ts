import {LinkOptions, structUtils}                      from '@yarnpkg/core';
import {VirtualFS, ZipOpenFS, ppath, Filename}         from '@yarnpkg/fslib';
import {getLibzipPromise}                              from '@yarnpkg/libzip';
import {PnpInstaller, PnpLinker}                       from '@yarnpkg/plugin-pnp';
import {NodeModulesPackageNode, buildNodeModulesTree}  from '@yarnpkg/pnpify';
import {PnpSettings, makeRuntimeApi, DependencyTarget} from '@yarnpkg/pnp';

export class PnpLooseLinker extends PnpLinker {
  protected mode = `loose`;

  makeInstaller(opts: LinkOptions) {
    return new PnpLooseInstaller(opts);
  }
}

class PnpLooseInstaller extends PnpInstaller {
  protected mode = `loose`;

  async finalizeInstallWithPnp(pnpSettings: PnpSettings) {
    if (this.opts.project.configuration.get(`pnpMode`) !== this.mode)
      return undefined;

    const defaultFsLayer = new VirtualFS({
      baseFs: new ZipOpenFS({
        libzip: await getLibzipPromise(),
        maxOpenFiles: 80,
        readOnlyArchives: true,
      }),
    });

    const pnp = makeRuntimeApi(pnpSettings, this.opts.project.cwd, defaultFsLayer);
    const nmTree = buildNodeModulesTree(pnp, {pnpifyFs: false});

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

    const entry = nmTree.get(root);
    if (typeof entry === `undefined`)
      throw new Error(`Assertion failed: Expected a root junction point`);

    if (`target` in entry)
      throw new Error(`Assertion failed: Expected the root junction point to be a directory`);

    for (const childName of entry.dirList) {
      const childP = ppath.join(root, childName);

      const child = nmTree.get(childP);
      if (typeof child === `undefined`)
        throw new Error(`Assertion failed: Expected the child to have been registered`);

      if (`target` in child) {
        registerFallback(childName, child);
      } else {
        for (const subChildName of child.dirList) {
          const subChildP = ppath.join(childP, subChildName);

          const subChild = nmTree.get(subChildP);
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

    return super.finalizeInstallWithPnp(pnpSettings);
  }
}
