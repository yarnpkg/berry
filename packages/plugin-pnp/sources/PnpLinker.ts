import {Linker, LinkOptions, MinimalLinkOptions}        from '@berry/core';
import {Locator, Manifest, Package, Project, Workspace} from '@berry/core';
import {structUtils}                                    from '@berry/core';
import {CwdFS, FakeFS}                                  from '@berry/zipfs';

type DTTState = {
  targetFs: FakeFS,
};

export class PnpLinker implements Linker<DTTState> {
  supports(pkg: Package, opts: MinimalLinkOptions) {
    return true;
  }

  async setup(opts: LinkOptions) {
    return {};
  }
}
