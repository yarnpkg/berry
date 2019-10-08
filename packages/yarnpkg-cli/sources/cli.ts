import './polyfills';

import {main}                from './main';
import {pluginConfiguration} from './pluginConfiguration';

main({
  binaryVersion: YARN_VERSION,
  pluginConfiguration,
});
