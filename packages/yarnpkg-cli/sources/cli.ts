import './polyfills';

// eslint-disable-next-line arca/import-ordering
import {YarnVersion}            from '@yarnpkg/core';

import {main}                   from './main';
import {getPluginConfiguration} from './tools/getPluginConfiguration';

export {getDynamicLibs} from "./tools/getDynamicLibs";

if (process.argv[1]) {
  main({
    binaryVersion: YarnVersion || `<unknown>`,
    pluginConfiguration: getPluginConfiguration(),
  });
}
