import {Configuration, JsonReport, PluginConfiguration} from '@berry/core';
import {miscUtils, SettingsType}                        from '@berry/core';
import {Writable}                                       from 'stream';
import {inspect}                                        from 'util';

function fromEntries(iterable: Iterable<[any, any] | {0: any, 1: any}>): {[key: string]: any} {
  return [... iterable].reduce((obj, { 0:key, 1: val}) => Object.assign(obj, {
    [key]: val,
  }), {});
}

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`config [-v,--verbose] [--why] [--json]`)
  .describe(`display the current configuration`)

  .detail(`
    This command prints the current active configuration settings.
    
    When used together with the \`-v,--verbose\` option, the output will contain the settings description on top of the regular key/value information.

    When used together with the \`--why\` flag, the output will also contain the reason why a settings is set a particular way.

    Note that the paths settings will be normalized - especially on Windows. It means that paths such as \`C:\\project\` will be transparently shown as \`/mnt/c/project\`.
  `)

  .example(
    `Print the active configuration settings`,
    `yarn config`,
  )

  .action(async ({cwd, stdout, verbose, why, json}: {cwd: string, stdout: Writable, verbose: boolean, why: boolean, json: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);

    const getValue = (key: string) => {
      const isSecret = configuration.settings.get(key)!.type === SettingsType.SECRET;
      const rawValue = configuration.values.get(key)!;

      if (isSecret && typeof rawValue === `string`) {
        return `********`;
      } else {
        return rawValue;
      }
    };

    const keys = miscUtils.sortMap(configuration.settings.keys(), key => key);
    const maxKeyLength = keys.reduce((max, key) => Math.max(max, key.length), 0);

    if (json) {
      const data = fromEntries(configuration.settings.entries());

      for (const key of Object.keys(data)) {
        data[key].effective = getValue(key);
        data[key].source = configuration.sources.get(key);
      }

      return JsonReport.send({stdout}, data);
    } else {
      const inspectConfig = {
        breakLength: Infinity,
        colors: configuration.get(`enableColors`),
        maxArrayLength: 2,
      };

      if (why || verbose) {
        const keysAndDescriptions = keys.map(key => {
          const setting = configuration.settings.get(key);

          if (!setting)
            throw new Error(`Assertion failed: This settings ("${key}") should have been registered`);

          const description = why
            ? configuration.sources.get(key) || `<default>`
            : setting.description;

          return [key, description] as [string, string];
        });

        const maxDescriptionLength = keysAndDescriptions.reduce((max, [, description]) => {
          return Math.max(max, description.length);
        }, 0);

        for (const [key, description] of keysAndDescriptions) {
          stdout.write(`${key.padEnd(maxKeyLength, ` `)}   ${description.padEnd(maxDescriptionLength, ` `)}   ${inspect(getValue(key), inspectConfig)}\n`);
        }
      } else {
        for (const key of keys) {
          stdout.write(`${key.padEnd(maxKeyLength, ` `)}   ${inspect(getValue(key), inspectConfig)}\n`);
        }
      }
    }
  });
