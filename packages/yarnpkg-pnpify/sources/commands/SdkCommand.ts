import {StreamReport, Configuration}             from '@yarnpkg/core';
import {NativePath, npath, ppath, xfs, Filename} from '@yarnpkg/fslib';
import {Command, UsageError}                     from 'clipanion';

import {dynamicRequire}                          from '../dynamicRequire';
import {generateSdk, SUPPORTED_EDITORS}          from '../generateSdk';

// eslint-disable-next-line arca/no-default-export
export default class SdkCommand extends Command {
  @Command.String(`--cwd`)
  cwd: NativePath = process.cwd();

  @Command.String(`--sdk`, {tolerateBoolean: true})
  sdk: string | boolean = false;

  static usage = Command.Usage({
    description: `generate editor SDKs`,
    details: `
      This command generates a new directory - \`.yarn/pnpify\`, which includes the base SDKs.

      It can be used as \`yarn pnpify --sdk\` or \`yarn pnpify --sdk=<arguments>\`.

      When used without arguments, it:

      - throws an error on non-pnpified projects

      - updates all existing SDKs and editor settings on already-pnpified projects

      When used with the \`base\` argument, it only installs the base SDKs.

      When used with the \`<editors>\` argument (\`vscode,vim\`), it installs the base SDKs and generates editor settings.

      The \`<editors>\` argument is a comma-separated list of supported editors.

      List of supported editors: ${[...SUPPORTED_EDITORS].join(`, `)}.

      **Note:** This command always updates the already-installed SDKs, no matter which arguments are passed.
    `,
    examples: [[
      `Generate the base SDKs`,
      `$0 --sdk=base`,
    ], [
      `Generate the base SDKs and editor settings for supported editors`,
      `$0 --sdk=vscode,vim`,
    ], [
      `Update all generated SDKs and editor settings`,
      `$0 --sdk`,
    ]],
  });

  async execute() {
    // Handle --no-sdk case
    if (this.sdk === false)
      throw new UsageError(`The --sdk flag can't be set to false`);

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

    const base = this.sdk === `base`;

    const editors = this.sdk === true || base
      ? null
      : new Set(this.sdk.split(`,`));

    const report = await StreamReport.start({
      configuration,
      includeFooter: false,
      stdout: this.context.stdout,
    }, async report => {
      await generateSdk(pnpApi, editors as (typeof SUPPORTED_EDITORS | null), {report, base});
    });

    return report.exitCode();
  }
}
