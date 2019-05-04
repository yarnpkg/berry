import { dynamicRequire } from './dynamicRequire';

process.env.NODE_OPTIONS = `-r ${dynamicRequire.resolve('.')} -r ${dynamicRequire.resolve('../../../.pnp')}`;
(process.mainModule as any).id = 'internal/preload';
dynamicRequire('../../../.pnp');
dynamicRequire('.').patchFs();
dynamicRequire('typescript/lib/tsserver');
