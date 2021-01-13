import {BaseCommand}                                         from '@yarnpkg/cli';
import {Configuration, StreamReport, MessageName, miscUtils} from '@yarnpkg/core';
import {Command, Option, Usage, UsageError}                  from 'clipanion';
import cloneDeep                                             from 'lodash/cloneDeep';
import getPath                                               from 'lodash/get';
import setPath                                               from 'lodash/set';
import {inspect}                                             from 'util';

// eslint-disable-next-line arca/no-default-export
export default class ConfigSetCommand extends BaseCommand {
  static paths = [
    [`config`, `set`],
  ];

  static usage: Usage = Command.Usage({
    description: `change a configuration settings`,
    details: `
      This command will set a configuration setting.

      When used without the \`--json\` flag, it can only set a simple configuration setting (a string, a number, or a boolean).

      When used with the \`--json\` flag, it can set both simple and complex configuration settings, including Arrays and Objects.
    `,
    examples: [[
      `Set a simple configuration setting (a string, a number, or a boolean)`,
      `yarn config set initScope myScope`,
    ], [
      `Set a simple configuration setting (a string, a number, or a boolean) using the \`--json\` flag`,
      `yarn config set initScope --json \\"myScope\\"`,
    ], [
      `Set a complex configuration setting (an Array) using the \`--json\` flag`,
      `yarn config set unsafeHttpWhitelist --json '["*.example.com", "example.com"]'`,
    ], [
      `Set a complex configuration setting (an Object) using the \`--json\` flag`,
      `yarn config set packageExtensions --json '{ "@babel/parser@*": { "dependencies": { "@babel/types": "*" } } }'`,
    ], [
      `Set a nested configuration setting`,
      `yarn config set npmScopes.company.npmRegistryServer "https://npm.example.com"`,
    ], [
      `Set a nested configuration setting using indexed access for non-simple keys`,
      `yarn config set 'npmRegistries["//npm.example.com"].npmAuthToken' "ffffffff-ffff-ffff-ffff-ffffffffffff"`,
    ]],
  });

  json = Option.Boolean(`--json`, false, {
    description: `Set complex configuration settings to JSON values`,
  });

  home = Option.Boolean(`-H,--home`, false, {
    description: `Update the home configuration instead of the project configuration`,
  });

  name = Option.String();
  value = Option.String();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    if (!configuration.projectCwd)
      throw new UsageError(`This command must be run from within a project folder`);

    const name = this.name.replace(/[.[].*$/, ``);
    const path = this.name.replace(/^[^.[]*\.?/, ``);

    const setting = configuration.settings.get(name);
    if (typeof setting === `undefined`)
      throw new UsageError(`Couldn't find a configuration settings named "${name}"`);

    const value: unknown = this.json
      ? JSON.parse(this.value)
      : this.value;

    const updateConfiguration: (patch: ((current: any) => any)) => Promise<void> =
      this.home
        ? patch => Configuration.updateHomeConfiguration(patch)
        : patch => Configuration.updateConfiguration(configuration.projectCwd!, patch);

    await updateConfiguration(current => {
      if (path) {
        const clone = cloneDeep(current);
        setPath(clone, this.name, value);
        return clone;
      } else {
        return {
          ...current,
          [name]: value,
        };
      }
    });

    const updatedConfiguration = await Configuration.find(this.context.cwd, this.context.plugins);
    const displayedValue = updatedConfiguration.getSpecial(name, {
      hideSecrets: true,
      getNativePaths: true,
    });

    const asObject = miscUtils.convertMapsToIndexableObjects(displayedValue);
    const requestedObject = path
      ? getPath(asObject, path)
      : asObject;

    const report = await StreamReport.start({
      configuration,
      includeFooter: false,
      stdout: this.context.stdout,
    }, async report => {
      // @ts-expect-error: The Node typings forgot one field
      inspect.styles.name = `cyan`;

      report.reportInfo(MessageName.UNNAMED, `Successfully set ${this.name} to ${inspect(requestedObject, {
        depth: Infinity,
        colors: configuration.get(`enableColors`),
        compact: false,
      })}`);
    });

    return report.exitCode();
  }
}
