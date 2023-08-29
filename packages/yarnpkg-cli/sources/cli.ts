import '@yarnpkg/cli/polyfills';
import {npath, ppath}           from '@yarnpkg/fslib';

import {runExit}                from './lib';
import {getPluginConfiguration} from './tools/getPluginConfiguration';

runExit(process.argv.slice(2), {
  cwd: ppath.cwd(),
  selfPath: npath.toPortablePath(npath.resolve(process.argv[1])),
  pluginConfiguration: getPluginConfiguration(),
});
