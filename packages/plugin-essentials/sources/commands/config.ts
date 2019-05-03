import {Configuration, MessageName, PluginConfiguration, SettingsType, StreamReport} from '@berry/core';
import {miscUtils}                                                                   from '@berry/core';
import {Writable}                                                                    from 'stream';
import {inspect}                                                                     from 'util';

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
    const configuration = await Configuration.find(cwd, pluginConfiguration, {
      strict: false,
    });

    const getValue = (key: string) => {
      const isSecret = configuration.settings.get(key)!.type === SettingsType.SECRET;
      const rawValue = configuration.values.get(key)!;

      if (isSecret && typeof rawValue === `string`) {
        return `********`;
      } else {
        return rawValue;
      }
    };

    const report = await StreamReport.start({configuration, json, stdout}, async report => {
      if (configuration.invalid.size > 0 && !json) {
        for (const [key, source] of configuration.invalid)
          report.reportError(MessageName.INVALID_CONFIGURATION_KEY, `Invalid configuration key "${key}" in ${source}`);

        report.reportSeparator();
      }

      if (json) {
        const keys = miscUtils.sortMap(configuration.settings.keys(), key => key);

        for (const key of keys) {
          const data = configuration.settings.get(key);

          const effective = getValue(key);
          const source = configuration.sources.get(key);

          if (verbose) {
            report.reportJson({key, effective, source});
          } else {
            report.reportJson({key, effective, source, ... data});
          }
        }
      } else {
        const keys = miscUtils.sortMap(configuration.settings.keys(), key => key);
        const maxKeyLength = keys.reduce((max, key) => Math.max(max, key.length), 0);
    
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
            report.reportInfo(MessageName.UNNAMED, `${key.padEnd(maxKeyLength, ` `)}   ${description.padEnd(maxDescriptionLength, ` `)}   ${inspect(getValue(key), inspectConfig)}`);
          }
        } else {
          for (const key of keys) {
            report.reportInfo(MessageName.UNNAMED, `${key.padEnd(maxKeyLength, ` `)}   ${inspect(getValue(key), inspectConfig)}`);
          }
        }
      }
    });

    return report.exitCode();
  });
