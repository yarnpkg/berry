import {StreamReport, Configuration}                               from '@yarnpkg/core';
import {NativePath, npath, ppath, xfs, Filename}                   from '@yarnpkg/fslib';
import {Command}                                                   from 'clipanion';

import {dynamicRequire}                                            from '../dynamicRequire';
import {generateSdk, SUPPORTED_INTEGRATIONS, SupportedIntegration} from '../generateSdk';

// eslint-disable-next-line arca/no-default-export
export default class SdkCommand extends Command {
  @Command.Rest()
  integrations: Array<string> = [];

  @Command.String(`--cwd`)
  cwd: NativePath = process.cwd();

  static usage = Command.Usage({
    description: `generate editor SDKs and settings`,
    details: `
      This command generates a new directory, \`.yarn/pnpify\`, which includes the base SDKs.

      When used without arguments, it:

      - throws an error on non-pnpified projects

      - updates all existing SDKs and editor settings on already-pnpified projects

      The optional \`integrations\` rest argument is a list of supported integrations or \`base\`.

      - When \`base\`, it only installs the base SDKs. Useful for when an editor is not yet supported and you need to manually update its settings.

      - When a list of editors (e.g. \`vscode vim\`), it installs the base SDKs and generates the corresponding editor settings.

      List of supported integrations: ${[...SUPPORTED_INTEGRATIONS.keys()].map(integration => `\`${integration}\``).join(`, `)}.

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

    const integrations = this.integrations.length === 0 || onlyBase
      ? new Set<SupportedIntegration>()
      : new Set(this.integrations);

    const report = await StreamReport.start({
      configuration,
      includeFooter: false,
      stdout: this.context.stdout,
    }, async report => {
      await generateSdk(pnpApi, integrations as Set<SupportedIntegration>, {report, onlyBase, configuration});
    });

    return report.exitCode();
  }
}
