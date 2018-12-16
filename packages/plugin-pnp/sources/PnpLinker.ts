import {Linker, LinkOptions, MinimalLinkOptions} from '@berry/core';
import {Locator, Package}                        from '@berry/core';
import {generatePnpScript}                       from '@berry/pnp';
import {FakeFS}                                  from '@berry/zipfs';

import {extractPnpSettings}                      from './extractPnpSettings';

type DTTState = {
  targetFs: FakeFS,
};

export class PnpLinker implements Linker<DTTState> {
  supports(pkg: Package, opts: MinimalLinkOptions) {
    return true;
  }

  async setup(opts: LinkOptions) {
    return {
      packageMapTraversal: {
        async onPackageMap(packageMap: Map<Locator, Package>, targetFs: FakeFS, api: any) {
          const pnpSettings = await extractPnpSettings(packageMap, api, opts);
          const pnpScript = generatePnpScript(pnpSettings);

          await targetFs.changeFilePromise(opts.project.configuration.pnpPath, pnpScript);
          await targetFs.chmodPromise(opts.project.configuration.pnpPath, 0o755);
        },
      },
    };
  }
}
