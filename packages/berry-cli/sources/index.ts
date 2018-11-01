import Joi = require('joi');

// @ts-ignore
import {concierge} from '@manaflair/concierge';

import {plugins}   from './plugins';

// @ts-ignore: require.context is valid with Webpack
concierge.directory(require.context(`./commands`, true, /\.ts$/));

concierge.topLevel(`[--cwd PATH]`).validate(Joi.object().unknown().keys({
  cwd: Joi.string().default(process.cwd()),
}))

for (const plugin of plugins.values())
  for (const command of plugin.commands || [])
    command(concierge, plugins);

concierge.runExit(process.argv0, process.argv.slice(2));
