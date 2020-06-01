import './polyfills';
import './yupExtensions';

import {YarnVersion}            from '@yarnpkg/core';

import {main}                   from './main';
import {getPluginConfiguration} from './tools/getPluginConfiguration';

main({
  binaryVersion: YarnVersion || `<unknown>`,
  pluginConfiguration: getPluginConfiguration(),
});
