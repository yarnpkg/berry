import * as npm                                                       from '@npm/types';
import {BaseCommand}                                                  from '@yarnpkg/cli';
import {Project, Configuration, structUtils, ReportError, Descriptor} from '@yarnpkg/core';
import {StreamReport, MessageName}                                    from '@yarnpkg/core';
import {npmHttpUtils}                                                 from '@yarnpkg/plugin-npm';
import {Command, Usage, UsageError}                                   from 'clipanion';
import path                                                           from 'path';
import semver                                                         from 'semver';
import {inspect}                                                      from 'util';

declare module '@npm/types' {
  /*
   * Add missing property `users` on interface `Packument`
   */
  interface Packument {
    users: Array<Record<string, boolean>>;
  }
}

/**
 * The combined type of `Packument` (without the `versions` field) and `PackumentVersion`
 */
type CombinedPackument = Omit<npm.Packument, 'versions'> & npm.PackumentVersion;

/**
 * `CombinedPackument` with a `versions` field that is an array of tags
 */
interface PackageInformation extends CombinedPackument {
  versions: Array<string>;
}

// eslint-disable-next-line arca/no-default-export
export default class InfoCommand extends BaseCommand {
  @Command.Rest()
  packages!: string;

  @Command.String(`-f,--fields`)
  fields?: string;

  @Command.Boolean(`--json`)
  json: boolean = false;

  static usage: Usage = Command.Usage({
    description: `show information about a package`,
    details: `
      This command will fetch information about a package from the npm registry, and prints it in a tree format.

      The package does not have to be installed locally, but needs to have been published (in particular, local changes will be ignored even for workspaces).

      Append \`@<range>\` to the package argument to provide information specific to the latest version that satisfies the range. If the range is invalid or if there is no version satisfying the range, the command will print a warning and fall back to the latest version.

      If the \`-f,--fields\` option is set, it's a comma-separated list of fields which will be used to only display part of the package informations.

      By default, this command won't return the \`dist\`, \`readme\`, and \`users\` fields, since they are often very long. To explicitly request those fields, explicitly list them with the \`--fields\` flag or request the output in JSON mode.

      If the \`--json\` flag is set the output will follow a JSON-stream output also known as NDJSON (https://github.com/ndjson/ndjson-spec).
    `,
    examples: [[
      `Show all available information about react (except the \`dist\`, \`readme\`, and \`users\` fields)`,
      `yarn npm info react`,
    ], [
      `Show all available information about react as valid JSON (including the \`dist\`, \`readme\`, and \`users\` fields)`,
      `yarn npm info react --json`,
    ], [
      `Show all available information about react 16.12.0`,
      `yarn npm info react@16.12.0`,
    ], [
      `Show the description of react`,
      `yarn npm info react --fields description`,
    ], [
      `Show all available versions of react`,
      `yarn npm info react --fields versions`,
    ], [
      `Show the readme of react`,
      `yarn npm info react --fields readme`,
    ], [
      `Show a few fields of react`,
      `yarn npm info react --fields homepage,repository`,
    ]],
  });

  @Command.Path(`npm`, `info`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);

    const fields = typeof this.fields !== `undefined`
      ? new Set([`name`, ...this.fields.split(/\s*,\s*/)])
      : null;

    const infos: Array<PackageInformation> = [];
    let leadWithSeparator = false;

    const report = await StreamReport.start({
      configuration,
      includeFooter: false,
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      for (const identStr of this.packages) {
        let descriptor: Descriptor;
        if (identStr === `.`) {
          const workspace = project.topLevelWorkspace;
          if (!workspace.manifest.name)
            throw new UsageError(`Missing 'name' field in ${path.join(workspace.cwd, `package.json`)}`);

          descriptor = structUtils.makeDescriptor(workspace.manifest.name, `unknown`);
        } else {
          descriptor = structUtils.parseDescriptor(identStr);
        }

        const identUrl = npmHttpUtils.getIdentUrl(descriptor);

        let result: npm.Packument;
        try {
          // The information from `registry.npmjs.org/<package>`
          result = clean(await npmHttpUtils.get(identUrl, {
            configuration,
            ident: descriptor,
            json: true,
          })) as npm.Packument;
        } catch (err) {
          if (err.name !== `HTTPError`) {
            throw err;
          } else if (err.response.statusCode === 404) {
            throw new ReportError(MessageName.EXCEPTION, `Package not found`);
          } else {
            throw new ReportError(MessageName.EXCEPTION, err.toString());
          }
        }

        const versions = Object.keys(result.versions).sort(semver.compareLoose);
        const fallbackVersion = result[`dist-tags`].latest || versions[versions.length - 1];

        // The latest version that satisfies `descriptor.range` (if it is a valid range), else `fallbackVersion`
        let version: string = fallbackVersion;
        if (semver.validRange(descriptor.range)) {
          const maxSatisfyingVersion = semver.maxSatisfying(versions, descriptor.range);

          if (maxSatisfyingVersion !== null) {
            version = maxSatisfyingVersion;
          } else {
            report.reportWarning(MessageName.UNNAMED, `Unmet range ${structUtils.prettyRange(configuration, descriptor.range)}; falling back to the latest version`);
            leadWithSeparator = true;
          }
        } else if (descriptor.range !== `unknown`) {
          report.reportWarning(MessageName.UNNAMED, `Invalid range ${structUtils.prettyRange(configuration, descriptor.range)}; falling back to the latest version`);
          leadWithSeparator = true;
        }

        const release = result.versions[version];

        /**
         * The merging of
         * @see `result` - The information from `registry.npmjs.org/<package>`
         * @see `release` - The release corresponding to `version`
         * @see `version` - The latest version that satisfies `descriptor.range` (if it is a valid range), else `fallbackVersion`
         * @see `versions` - All version tags of a package, sorted in ascending order
         */
        const packageInformation: PackageInformation = {
          ...result,
          ...release,
          version,
          versions,
        };

        let serialized: any;
        if (fields !== null) {
          serialized = {};

          for (const field of fields) {
            // @ts-ignore
            const value = packageInformation[field];

            if (typeof value !== `undefined`) {
              serialized[field] = value;
            } else {
              report.reportWarning(MessageName.EXCEPTION, `The '${field}' field doesn't exist inside ${structUtils.prettyIdent(configuration, descriptor)}'s informations`);
              leadWithSeparator = true;
              continue;
            }
          }
        } else {
          // Remove long fields
          if (!this.json) {
            delete packageInformation.dist;
            delete packageInformation.readme;
            delete packageInformation.users;
          }

          serialized = packageInformation;
        }

        report.reportJson(serialized);

        if (!this.json) {
          infos.push(serialized);
        }
      }
    });

    // @ts-ignore: The Node typings forgot one field
    inspect.styles.name = `cyan`;

    for (const serialized of infos) {
      if (serialized !== infos[0] || leadWithSeparator)
        this.context.stdout.write(`\n`);

      this.context.stdout.write(`${inspect(serialized, {
        depth: Infinity,
        colors: true,
        compact: false,
      })}\n`);
    }

    return report.exitCode();
  }
}

// Remove hidden properties recursively
function clean(value: unknown): unknown {
  if (Array.isArray(value)) {
    const result: Array<unknown> = [];

    for (let item of value) {
      item = clean(item);

      if (item) {
        result.push(item);
      }
    }

    return result;
  } else if (typeof value === `object` && value !== null) {
    const result: any = {};

    for (const key of Object.keys(value)) {
      if (key.startsWith(`_`))
        continue;

      const item = clean(value[key as keyof typeof value]);
      if (item) {
        result[key] = item;
      }
    }

    return result;
  } else if (value) {
    return value;
  } else {
    return null;
  }
}
