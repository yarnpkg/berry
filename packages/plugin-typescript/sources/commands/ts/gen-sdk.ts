import {WorkspaceRequiredError}                                                              from '@berry/cli';
import {Configuration, MessageName, PluginConfiguration, Project, StreamReport, structUtils} from '@berry/core';
import {xfs}                                                                                 from '@berry/fslib';
import {Readable, Writable}                                                                  from 'stream';

const PNPIFY_IDENT = structUtils.makeIdent(`berry`, `pnpify`);

const TEMPLATE = [
  `// Locate the top-level PnP api\n`,
  `const {PnPApiLocator} = require('@berry/pnpify');\n`,
  `const pnpApiPath = new PnPApiLocator().findApi(__dirname);\n`,
  `\n`,
  `// If we don't find one, something is off\n`,
  `if (!pnpApiPath)\n`,
  `  throw new Error(\`Couldn't locate the PnP API to use with the SDK\`);\n`,
  `\n`,
  `// Setup the environment to be able to require @berry/pnpify\n`,
  `require(pnpApiPath).setup();\n`,
  `\n`,
  `// Prepare the environment (to be ready in case of child_process.spawn etc)\n`,
  `process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || \`\`;\n`,
  `process.env.NODE_OPTIONS += \` -r \${pnpApiPath}\`;\n`,
  `process.env.NODE_OPTIONS += \` -r \${require.resolve(\`@berry/pnpify\`)}\`;\n`,
  `\n`,
  `// Apply PnPify to the current process\n`,
  `require(\`@berry/pnpify\`).patchFs();\n`,
  `\n`,
  `// Defer to the real typescript your application uses\n`,
  `require(\`typescript/lib/tsserver\`);\n`,
].join(``);

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`ts gen-sdk [path]`)
  .categorize(`TypeScript-related commands`)
  .describe(`generate a TS sdk compatible with vscode`)

  .detail(`
    This command generates a TypeScript SDK folder compatible with what VSCode expects to find in its \`typescript.sdk\` settings.

    The SDK folder (called \`tssdk\`) will by default be generated in the top-level folder of your project, but you can change this by specifying any other path as first and unique positional argument.
  `)

  .example(
    `Generate a \`tssdk\` folder in the default location`,
    `yarn ts gen-sdk`,
  )

  .example(
    `Generate a \`tssdk\` folder in the \`scripts\` directory`,
    `yarn ts gen-sdk scripts`,
  )

  .action(async ({cwd, stdin, stdout, stderr, path}: {cwd: string, stdin: Readable, stdout: Writable, stderr: Writable, path: string}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project, workspace} = await Project.find(configuration, cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(cwd);

    const destination = path
      ? `${path}/tssdk`
      : `${project.cwd}/tssdk`;

    if (!project.topLevelWorkspace.manifest.hasHardDependency(PNPIFY_IDENT)) {
      const addExitCode = await clipanion.run(null, [`add`, `-D`, `--`, structUtils.stringifyIdent(PNPIFY_IDENT)], {cwd: project.cwd, stdin, stdout, stderr});
      if (addExitCode !== 0)
        return addExitCode;
      
      stdout.write(`\n`);
    }

    const report = await StreamReport.start({configuration, stdout}, async report => {
      await xfs.removePromise(`${destination}`);
      await xfs.mkdirpPromise(`${destination}/lib`);
      await xfs.writeFilePromise(`${destination}/lib/tsserver.js`, TEMPLATE);

      report.reportInfo(MessageName.UNNAMED, `Generated the SDK in ${destination}`);
    });

    return report.exitCode();
  });
