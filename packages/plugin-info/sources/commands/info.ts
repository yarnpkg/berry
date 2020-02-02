import * as npm                              from '@npm/types';
import {BaseCommand, WorkspaceRequiredError} from '@yarnpkg/cli';
import {Project, Configuration, structUtils} from '@yarnpkg/core';
import {StreamReport, MessageName}           from '@yarnpkg/core';
import {npmHttpUtils}                        from '@yarnpkg/plugin-npm';
import {Command, Usage, UsageError}          from 'clipanion';
import JSON5                                 from 'json5';
import path                                  from 'path';
import semver                                from 'semver';

declare module '@npm/types' {
  /*
   * Add missing property `users` on interface `Packument`
   */
  interface Packument {
    users: Record<string, boolean>[];
  }
}

// eslint-disable-next-line arca/no-default-export
export default class InfoCommand extends BaseCommand {
  @Command.String({required: true})
  package!: string;

  @Command.String({required: false})
  field!: string;

  @Command.Boolean(`-v,--verbose`)
  verbose: boolean = false;

  @Command.Boolean(`--json`)
  json: boolean = false;

  static usage: Usage = Command.Usage({
    description: `show information about a package`,
    details: `
      This command will fetch information about a package and return it in a tree format.
      The package does not have to have been installed locally.

      The default reporting style for this command is a single-quoted serialization (JSON5). To emit lines of valid JSON, use the \`--json\` flag.

      Append \`@[version]\` to the package argument to provide information specific to that version. If the version is invalid, the command falls back to latest.

      If the optional field argument is provided, then only that part of the tree is returned.

      By default, \`yarn info\` will not return the \`dist\`, \`readme\`, and \`users\` fields, since they are often very long. To explicitly request those fields, use the \`-v,--verbose\` flag or the second argument: \`yarn info react readme\`
    `,
    examples: [[
      `Show all available information about react (except the \`dist\`, \`readme\`, and \`users\` fields)`,
      `yarn info react`,
    ],[
      `Show all available information about react, including the \`dist\`, \`readme\`, and \`users\` fields`,
      `yarn info react --verbose`,
    ],[
      `Show all available information about react as valid JSON`,
      `yarn info react --json`,
    ],[
      `Show all available information about react 16.12.0`,
      `yarn info react@16.12.0`,
    ],[
      `Show the description of react`,
      `yarn info react description`,
    ],[
      `Show all available versions of react`,
      `yarn info react versions`,
    ],[
      `Show the readme of react`,
      `yarn info react readme`,
    ]],
  });

  @Command.Path(`info`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    /*
     * Handle case when the package is the current workspace
     */
    if (this.package === `.`) {
      const {project, workspace} = await Project.find(configuration, this.context.cwd);

      if (!workspace)
        throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

      if (!workspace.manifest.name)
        throw new UsageError(`Missing \`name\` field in ${path.join(workspace.cwd, `package.json`)}`);

      this.package = structUtils.stringifyIdent(workspace.manifest.name);
    }

    const descriptor = structUtils.parseDescriptor(this.package);
    const identUrl = npmHttpUtils.getIdentUrl(descriptor);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      try {
        /**
         * The information from `registry.npmjs.org/<package>`
         */
        const result = clean(
          await npmHttpUtils.get(identUrl, {
            configuration,
            ident: descriptor,
            json: true,
          })
        ) as npm.Packument;

        /**
         * All version tags of a package, sorted in ascending order
         */
        const versions = Object.keys(result.versions).sort(semver.compareLoose);

        /**
         * Check if the package range from the command arguments is a valid version
         */
        const isRangeValid = descriptor.range !== `unknown` && semver.valid(descriptor.range);

        /**
         * The `descriptor.range` if it is a valid version, else the latest dist-tag or the greatest version
         */
        const version = isRangeValid
          ? descriptor.range
          : (result[`dist-tags`].latest || versions[versions.length - 1]);

        /**
         * The release corresponding to `version`
         */
        const release = result.versions[version];

        /**
         * The combined type of `Packument` (without the `versions` field) and `PackumentVersion`
         */
        type CombinedPackument = Omit<npm.Packument, 'versions'> & npm.PackumentVersion;

        /**
         * `CombinedPackument` with a `versions` field that is an array of tags
         */
        interface PackageInformation extends CombinedPackument {
          versions: string[];
        }

        /**
         * The merging of
         * @see `result` - The information from `registry.npmjs.org/<package>`
         * @see `release` - The release corresponding to `version`
         * @see `version` - `descriptor.range` if it is a valid version, else the latest dist-tag or the greatest version
         * @see `versions` - All version tags of a package, sorted in ascending order
         */
        const packageInformation: PackageInformation = {
          ...result,
          ...release,
          version,
          versions,
        };

        /**
         * The filtered data that the command will output
         */
        let data: unknown;

        if (this.field) {
          /**
           * The requested field
           */
          const fields = Object.keys(packageInformation).filter(key => key === this.field);
          if (!fields.length) {
            report.reportError(MessageName.EXCEPTION, `The \`${this.field}\` field doesn't exist inside \`${this.package}\`'s information`);
          } else if (fields.length === 1) {
            data = packageInformation[fields[0] as keyof PackageInformation];
          }
        } else {
          if (!this.verbose) {
            /**
             * Remove long fields
             */
            delete packageInformation.dist;
            delete packageInformation.readme;
            delete packageInformation.users;
          }
          data = packageInformation;
        }


        if (this.json) {
          data = JSON.stringify(data);
        } else {
          data = JSON5.stringify(data, {
            space: 2,
          });
        }

        if (typeof data === `string`) {
          report.reportInfo(MessageName.UNNAMED, `\n${data}`);
        }
      } catch (err) {
        if (err.name !== `HTTPError`) {
          throw err;
        } else if (err.response.statusCode === 404) {
          report.reportError(MessageName.EXCEPTION, `Package not found`);
        } else {
          report.reportError(MessageName.EXCEPTION, err.toString());
        }
      }
    });

    return report.exitCode();
  }
}

// Remove hidden properties recursively
function clean(value: unknown): unknown {
  if (Array.isArray(value)) {
    const result: unknown[] = [];

    value.forEach((item) => {
      item = clean(item);
      if (item) {
        result.push(item);
      }
    });

    return result;
  } else if (typeof value === `object` && value !== null) {
    const result: any = {};

    Object.keys(value).forEach((key) => {
      if (key.startsWith(`_`))
        return;
      const item = clean(value[key as keyof typeof value]);
      if (item) {
        result[key] = item;
      }
    });

    return result;
  } else if (value) {
    return value;
  } else {
    return null;
  }
}
