import {StreamReport, Configuration}                                                                       from '@yarnpkg/core';
import {npath, ppath, xfs, Filename}                                                                       from '@yarnpkg/fslib';
import type {PnpApi}                                                                                       from '@yarnpkg/pnp';
import {Command, Option, UsageError}                                                                       from 'clipanion';

import {dynamicRequire}                                                                                    from '../dynamicRequire';
import {generateSdk, validateIntegrations, SUPPORTED_INTEGRATIONS, SupportedIntegration, IntegrationsFile} from '../generateSdk';

// eslint-disable-next-line arca/no-default-export
export default class SdkCommand extends Command {
  static paths = [
    Command.Default,
  ];

  static usage = Command.Usage({
    description: `generate editor SDKs and settings`,
    details: `
      This command generates a new directory, \`.yarn/sdks\`, which includes the base SDKs.

      When used without arguments, it:

      - throws an error on non-pnpified projects

      - updates all existing SDKs and editor settings on already-pnpified projects

      The optional integrations arguments are a set of supported integrations, or the keyword \`base\`.

      - When \`base\` is used, only the base SDKs will be generated. This is useful for when an editor is not yet supported and you plan to manage the settings yourself.

      - When a set of integrations is used (e.g. \`vscode\`, \`vim\`, ...), the base SDKs will be installed plus all the settings relevant to the corresponding environments (for example on VSCode it would set \`typescript.tsdk\`).

      The supported integrations at this time are: ${[...SUPPORTED_INTEGRATIONS.keys()].map(integration => `\`${integration}\``).join(`, `)}.

      **Note:** This command always updates the already-installed SDKs and editor settings, no matter which arguments are passed.

      For more details on Editor SDKs, please consult the dedicated page from our website: https://yarnpkg.com/getting-started/editor-sdks.
    `,
    examples: [[
      `Generate the base SDKs`,
      `$0 base`,
    ], [
      `Generate the base SDKs and editor settings for supported editors`,
      `$0 vscode vim`,
    ], [
      `Update all generated SDKs and editor settings`,
      `$0`,
    ]],
  });

  cwd = Option.String(`--cwd`, process.cwd(), {
    description: `The directory to run the command in`,
  });

  verbose = Option.Boolean(`-v,--verbose`, false, {
    description: `Print all skipped dependencies`,
  });

  integrations = Option.Rest();

  async execute() {
    let nextProjectRoot = npath.toPortablePath(this.cwd);
    let currProjectRoot = null;

    let pnpFilename!: Filename;
    while (nextProjectRoot !== currProjectRoot) {
      currProjectRoot = nextProjectRoot;
      nextProjectRoot = ppath.dirname(currProjectRoot);

      if (xfs.existsSync(ppath.join(currProjectRoot, Filename.pnpCjs))) {
        pnpFilename = Filename.pnpCjs;
        break;
      }

      // TODO: Drop support for .pnp.js files after they stop being used.
      if (xfs.existsSync(ppath.join(currProjectRoot, Filename.pnpJs))) {
        pnpFilename = Filename.pnpJs;
        break;
      }
    }

    if (nextProjectRoot === currProjectRoot)
      throw new Error(`This tool can only be used with projects using Yarn Plug'n'Play`);

    const configuration = Configuration.create(currProjectRoot);
    const pnpPath = ppath.join(currProjectRoot, pnpFilename);
    const pnpApi = dynamicRequire(npath.fromPortablePath(pnpPath)) as PnpApi;

    // Need to setup the fs patch so we can read from the archives
    (pnpApi as unknown as {setup: Function})?.setup();

    const onlyBase = this.integrations.length === 1 && this.integrations[0] === `base`;

    const requestedIntegrations = this.integrations.length === 0 || onlyBase
      ? new Set<SupportedIntegration>()
      : new Set(this.integrations as Array<SupportedIntegration>);

    validateIntegrations(requestedIntegrations);

    const topLevelInformation = pnpApi.getPackageInformation(pnpApi.topLevel)!;
    const projectRoot = npath.toPortablePath(topLevelInformation.packageLocation);

    const integrationsFile = await IntegrationsFile.find(projectRoot);

    const preexistingIntegrations = integrationsFile !== null
      ? integrationsFile.integrations
      : new Set<SupportedIntegration>();

    const allIntegrations = new Set([
      ...requestedIntegrations,
      ...preexistingIntegrations,
    ]);

    if (allIntegrations.size === 0 && !onlyBase)
      throw new UsageError(`No integrations have been provided as arguments, and no preexisting integrations could be found. Make sure to run \`yarn sdks <integrations>\` first, or \`yarn sdks base\` if you only need the SDK files and prefer to manage your own environment settings. Run \`yarn sdks -h\` to see the list of supported integrations.`);

    const report = await StreamReport.start({
      configuration,
      includeFooter: false,
      stdout: this.context.stdout,
    }, async report => {
      await generateSdk(pnpApi, {
        requestedIntegrations,
        preexistingIntegrations,
      }, {
        report,
        onlyBase,
        configuration,
        verbose: this.verbose,
      });
    });

    return report.exitCode();
  }
}
