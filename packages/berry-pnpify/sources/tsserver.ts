import { PnPApiLocator }  from './PnPApiLocator';
import { dynamicRequire } from './dynamicRequire';

process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + `-r ${dynamicRequire.resolve('.')}`;
const pnpApiPath = new PnPApiLocator().findApi(__dirname);
if (pnpApiPath) {
  (process.mainModule as any).id = 'internal/preload';
  dynamicRequire(pnpApiPath);
  process.env.NODE_OPTIONS += ` -r ${pnpApiPath}` ;
}

dynamicRequire('.').patchFs();
dynamicRequire('typescript/lib/tsserver');
