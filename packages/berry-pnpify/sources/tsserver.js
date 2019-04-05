const path = require('path');
process.env.NODE_OPTIONS = `-r ${path.resolve('../../../.pnp')} -r ${path.resolve('.')}`;
module.id = 'internal/preload';
require('../../../.pnp');
require('.');
require('typescript/lib/tsserver');
