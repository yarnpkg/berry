import {Configuration, PluginConfiguration, Project} from '@berry/core';
import {execUtils, scriptUtils}                      from '@berry/core';
import {PortablePath}                                from '@berry/fslib';
import {Readable, Writable}                          from 'stream';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`node [... args]`)
  .describe(`run node with the hook already setup`)
  .flags({proxyArguments: true})

  .detail(`
    This command simply runs Node. It also makes sure to call it in a way that's compatible with the current project (for example, on PnP projects the environment will be setup in such a way that PnP will be correctly injected into the environment).

    The Node process will use the exact same version of Node as the one used to run Yarn itself, which might be a good way to ensure that your commands always use a consistent Node version.
  `)

  .example(
    `Run a Node script`,
    `yarn node ./my-script.js`,
  )

  .action(async ({cwd, stdin, stdout, stderr, args}: {cwd: PortablePath, stdin: Readable, stdout: Writable, stderr: Writable, args: Array<string>}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project} = await Project.find(configuration, cwd);

    const env = await scriptUtils.makeScriptEnv(project);
    const {code} = await execUtils.pipevp(`node`, args, {cwd, stdin, stdout, stderr, env});

    return code;
  });
