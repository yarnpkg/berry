import {Configuration, Plugin} from '@berry/core';
import {miscUtils}             from '@berry/core';
import {Writable}              from 'stream';
import {inspect}               from 'util';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`config [-v,--verbose]`)
  .describe(`display the current configuration`)

  .action(async ({cwd, stdout, verbose}: {cwd: string, stdout: Writable, verbose: boolean}) => {
    const configuration = await Configuration.find(cwd, plugins);

    const keys = miscUtils.sortMap(configuration.settings.keys(), key => key);
    const maxKeyLength = keys.reduce((max, key) => Math.max(max, key.length), 0);

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
  });
