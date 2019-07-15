import {Configuration, MessageName, PluginConfiguration, Project, StreamReport, httpUtils, structUtils}                      from '@berry/core';
import {xfs, PortablePath, ppath}                                                                                            from '@berry/fslib';
import {parseSyml}                                                                                                           from '@berry/parsers';
import {Clipanion}                                                                                                           from 'clipanion';
import {Writable}                                                                                                            from 'stream';
import {runInNewContext}                                                                                                     from 'vm';

const REMOTE_REGISTRY = `https://raw.githubusercontent.com/yarnpkg/berry/master/plugins.yml`;

// eslint-disable-next-line arca/no-default-export
export default (clipanion: Clipanion, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`plugin dl [name] [-l,--list]`)
  .alias(`plugins dl`)
  .describe(`list the active plugins`)

  .detail(`
    This command downloads the specified plugin from its remote location and updates the configuration to reference it in further CLI invocations.

    If the \`-l,--list\` option is present, Yarn will print the list of plugins available from the official Yarn repository. Those plugins are not mandatory or necessarily better than the ones provided by the community.
  `)

  .example(
    `Download and activate the "@berry/plugin-exec" plugin`,
    `yarn plugin dl @berry/plugin-exec`,
  )

  .example(
    `Download and activate a community plugin`,
    `yarn plugin dl https://example.org/path/to/plugin.js`,
  )

  .example(
    `List the official plugins`,
    `yarn plugin dl --list`,
  )

  .action(async ({cwd, stdout, list, name}: {cwd: PortablePath, stdout: Writable, list: boolean, name: string}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);

    const report = await StreamReport.start({configuration, stdout}, async report => {
      if (list) {
        const raw = await httpUtils.get(REMOTE_REGISTRY, {configuration});
        const data = parseSyml(raw.toString());

        for (const [name, {experimental}] of Object.entries(data)) {
          let label = name;

          if (experimental)
            label += ` [experimental]`;

          report.reportInfo(MessageName.UNNAMED, label);
        }
      } else {
        const {project} = await Project.find(configuration, cwd);
        const ident = structUtils.tryParseIdent(name);

        let pluginUrl;
        if (ident) {
          const key = structUtils.stringifyIdent(ident);

          const raw = await httpUtils.get(REMOTE_REGISTRY, {configuration});
          const data = parseSyml(raw.toString()) as any;

          if (!Object.prototype.hasOwnProperty.call(data, key))
            throw new Error(`Couldn't find a plugin named "${key}" on the remote registry`);

          pluginUrl = data[key].url;
        } else {
          try {
            // @ts-ignore We don't want to add the dom to the TS env just for this line
            new URL(name);
          } catch {
            throw new Error(`Plugin specifier "${name}" is neither a plugin name nor a valid url`);
          }

          pluginUrl = name;
        }

        report.reportInfo(MessageName.UNNAMED, `Downloading ${configuration.format(pluginUrl, `green`)}`);
        const pluginBuffer = await httpUtils.get(pluginUrl, {configuration});

        const vmExports = {} as any;
        const vmModule = {exports: vmExports};

        runInNewContext(pluginBuffer.toString(), {
          module: vmModule,
          exports: vmExports,
        });

        const relativePath = `.yarn/plugins/${vmModule.exports.name}.js` as PortablePath;
        const absolutePath = ppath.resolve(project.cwd, relativePath);

        report.reportInfo(MessageName.UNNAMED, `Saving the new plugin in ${configuration.format(relativePath, `magenta`)}`);
        await xfs.mkdirpPromise(ppath.dirname(absolutePath));
        await xfs.writeFilePromise(absolutePath, pluginBuffer);

        await Configuration.updateConfiguration(project.cwd, (current: any) => ({
          plugins: (current.plugins || []).concat([
            relativePath,
          ]),
        }));
      }
    });

    return report.exitCode();
  });
