import {runExit}                from './lib';
import {getPluginConfiguration} from './tools/getPluginConfiguration';

runExit(process.argv.slice(2), {
  pluginConfiguration: getPluginConfiguration(),
});
