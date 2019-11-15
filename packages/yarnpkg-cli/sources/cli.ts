import './polyfills';

import {main}                   from './main';
import {getPluginConfiguration} from './tools/getPluginConfiguration';

main({
  binaryVersion: YARN_VERSION,
  pluginConfiguration: getPluginConfiguration(),
});
