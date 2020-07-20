import {StreamReport, Configuration}                                                                       from '@yarnpkg/core';
import {NativePath, npath, ppath, xfs, Filename}                                                           from '@yarnpkg/fslib';
import {Command, UsageError}                                                                               from 'clipanion';

import {dynamicRequire}                                                                                    from '../dynamicRequire';
import {generateSdk, validateIntegrations, SUPPORTED_INTEGRATIONS, SupportedIntegration, IntegrationsFile} from '../generateSdk';

// eslint-disable-next-line arca/no-default-export
export default class SdkCommand extends Command {
  @Command.Rest()
  integrations: Array<string> = [];

  @Command.String(`--cwd`)
  cwd: NativePath = process.cwd();

  @Command.Boolean(`-v,--verbose`)
  verbose: boolean = false;

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
    `,
    examples: [[
      `Generate the base SDKs`,
      `$0 --sdk base`,
    ], [
      `Generate the base SDKs and editor settings for supported editors`,
      `$0 --sdk vscode vim`,
    ], [
      `Update all generated SDKs and editor settings`,
      `$0 --sdk`,
    ]],
  });

  @Command.Path(`--sdk`)
  async execute() {
    let nextProjectRoot = npath.toPortablePath(this.cwd);
    let currProjectRoot = null;

    let isCJS = ``;
    while (nextProjectRoot !== currProjectRoot) {
      currProjectRoot = nextProjectRoot;
      nextProjectRoot = ppath.dirname(currProjectRoot);

      if (xfs.existsSync(ppath.join(currProjectRoot, `.pnp.js` as Filename)))
        break;

      if (xfs.existsSync(ppath.join(currProjectRoot, `.pnp.cjs` as Filename))) {
        isCJS = `c`;
        break;
      }
    }

    if (nextProjectRoot === currProjectRoot)
      throw new Error(`This tool can only be used with projects using Yarn Plug'n'Play`);

    const configuration = Configuration.create(currProjectRoot);
    const pnpPath = ppath.join(currProjectRoot, `.pnp.${isCJS}js` as Filename);
    const pnpApi = dynamicRequire(pnpPath);

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
      throw new UsageError(`No integrations have been provided as arguments, and no preexisting integrations could be found. Make sure to run \`yarn pnpify --sdk <integrations>\` first, or \`yarn pnpify --sdk base\` if you only need the SDK files and prefer to manage your own environment settings. Run \`yarn pnpify --sdk -h\` to see the list of supported integrations.`);

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
