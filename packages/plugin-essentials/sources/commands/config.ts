import {Configuration, JsonReport, PluginConfiguration} from '@berry/core';
import {miscUtils}                                      from '@berry/core';
import {Writable}                                       from 'stream';
import {inspect}                                        from 'util';

function fromEntries(iterable: Iterable<[any, any] | {0: any, 1: any}>): {[key: string]: any} {
  return [... iterable].reduce((obj, { 0:key, 1: val}) => Object.assign(obj, {
    [key]: val,
  }), {});
}


export default (concierge: any, pluginConfiguration: PluginConfiguration) => concierge

  .command(`config [-v,--verbose] [--json]`)
  .describe(`display the current configuration`)

  .detail(`
    This command prints the current active configuration settings. When used together with the \`-v,--verbose\` option, the output will contain the settings description on top of the regular key/value information.
  `)

  .example(
    `Prints the active configuration settings`,
    `yarn config`,
  )

  .action(async ({cwd, stdout, verbose, json}: {cwd: string, stdout: Writable, verbose: boolean, json: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);

    const keys = miscUtils.sortMap(configuration.settings.keys(), key => key);
    const maxKeyLength = keys.reduce((max, key) => Math.max(max, key.length), 0);

    if (json) {
      const data = fromEntries(configuration.settings.entries());

      for (const key of Object.keys(data))
        data[key].effective = configuration.get(key);

      return JsonReport.send({stdout}, data);
    } else {
      const inspectConfig = {
        breakLength: Infinity,
        colors: configuration.get(`enableColors`),
        maxArrayLength: 2,
      };
  
      if (verbose) {
        const keysAndDescriptions = keys.map(key => {
          const settings = configuration.settings.get(key);

          if (!settings)
            throw new Error(`Assertion failed: This settings ("${key}") should have been registered`);

          return [key, settings.description] as [string, string];
        });

        const maxDescriptionLength = keysAndDescriptions.reduce((max, [, description]) => {
          return Math.max(max, description.length);
        }, 0);

        for (const [key, description] of keysAndDescriptions) {
          stdout.write(`${key.padEnd(maxKeyLength, ` `)}   ${description.padEnd(maxDescriptionLength, ` `)}   ${inspect(configuration.values.get(key), inspectConfig)}\n`);
        }
      } else {
        for (const key of keys) {
          stdout.write(`${key.padEnd(maxKeyLength, ` `)}   ${inspect(configuration.values.get(key), inspectConfig)}\n`);
        }
      }
    }
  });
