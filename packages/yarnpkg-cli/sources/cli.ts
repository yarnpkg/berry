import '@yarnpkg/cli/polyfills';
import {npath}                  from '@yarnpkg/fslib';

import {runExit}                from './lib';
import {getPluginConfiguration} from './tools/getPluginConfiguration';

runExit(process.argv.slice(2), {
  selfPath: npath.toPortablePath(npath.resolve(process.argv[1])),
  pluginConfiguration: getPluginConfiguration(),
});
