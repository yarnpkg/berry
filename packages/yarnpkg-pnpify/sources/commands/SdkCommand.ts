import {StreamReport, Configuration}             from '@yarnpkg/core';
import {NativePath, npath, ppath, xfs, Filename} from '@yarnpkg/fslib';
import {Command, UsageError}                     from 'clipanion';

import {dynamicRequire}                          from '../dynamicRequire';
import {generateSdk, SUPPORTED_EDITORS}          from '../generateSdk';

type SetTemplate<S> = S extends Set<infer T> ? T : never;

// eslint-disable-next-line arca/no-default-export
export default class SdkCommand extends Command {
  @Command.String(`--cwd`)
  cwd: NativePath = process.cwd();

  @Command.String(`--sdk`, {tolerateBoolean: true})
  sdk: string | boolean = false;

  async execute() {
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

    const editors = this.sdk === true
      ? null
      : new Set(this.sdk.split(`|`));

    const report = await StreamReport.start({
      configuration,
      includeFooter: false,
      stdout: this.context.stdout,
    }, async report => {
      if (editors !== null) {
        const unsupportedEditors: Array<string> = [];

        for (const editor of editors) {
          if (!SUPPORTED_EDITORS.has(editor as SetTemplate<typeof SUPPORTED_EDITORS>)) {
            unsupportedEditors.push(editor);
          }
        }

        if (unsupportedEditors.length > 0) {
          throw new UsageError(`No supported editors with the following names could be found:\n${unsupportedEditors.join(`, `)}`);
        }
      }

      await generateSdk(pnpApi, editors as (typeof SUPPORTED_EDITORS | null), report);
    });

    return report.exitCode();
  }
}
