process.env.NODE_OPTIONS = `-r ${require.resolve('.')} -r ${require.resolve('../../../.pnp')}`;
module.id = 'internal/preload';
require('../../../.pnp');
require('.');
require('typescript/lib/tsserver');
