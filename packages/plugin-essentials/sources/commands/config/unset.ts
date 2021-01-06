import {BaseCommand}                              from '@yarnpkg/cli';
import {Configuration, StreamReport, MessageName} from '@yarnpkg/core';
import {Command, Usage, UsageError}               from 'clipanion';
import cloneDeep                                  from 'lodash/cloneDeep';
import unsetPath                                  from 'lodash/unset';

// eslint-disable-next-line arca/no-default-export
export default class ConfigUnsetCommand extends BaseCommand {
  @Command.String()
  name!: string;

  @Command.Boolean(`-H,--home`, {description: `Update the home configuration instead of the project configuration`})
  home: boolean = false;

  static usage: Usage = Command.Usage({
    description: `unset a configuration settings`,
    details: `
      This command will set a configuration setting.
    `,
    examples: [[
      `Unset a simple configuration setting`,
      `yarn config set initScope`,
    ], [
      `Unset a complex configuration setting`,
      `yarn config set packageExtensions`,
    ], [
      `Unset a nested configuration setting`,
      `yarn config set npmScopes.company.npmRegistryServer`,
    ]],
  });

  @Command.Path(`config`, `unset`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    if (!configuration.projectCwd)
      throw new UsageError(`This command must be run from within a project folder`);

    const name = this.name.replace(/[.[].*$/, ``);
    const path = this.name.replace(/^[^.[]*\.?/, ``);

    const setting = configuration.settings.get(name);
    if (typeof setting === `undefined`)
      throw new UsageError(`Couldn't find a configuration settings named "${name}"`);

    const updateConfiguration: (patch: ((current: any) => any)) => Promise<void> =
      this.home
        ? patch => Configuration.updateHomeConfiguration(patch)
        : patch => Configuration.updateConfiguration(configuration.projectCwd!, patch);

    await updateConfiguration(current => {
      if (path) {
        const clone = cloneDeep(current);
        unsetPath(clone, this.name);
        return clone;
      } else {
        const next = unsetPath({...current}, name);
        return next;
      }
    });

    const report = await StreamReport.start({
      configuration,
      includeFooter: false,
      stdout: this.context.stdout,
    }, async report => {
      report.reportInfo(MessageName.UNNAMED, `Successfully unset ${this.name}`);
    });

    return report.exitCode();
  }
}
