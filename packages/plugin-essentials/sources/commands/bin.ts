import {BaseCommand}                                       from '@yarnpkg/cli';
import {Configuration, Project, ThrowReport, StreamReport} from '@yarnpkg/core';
import {scriptUtils, structUtils}                          from '@yarnpkg/core';
import {Command, Usage, UsageError}                        from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class BinCommand extends BaseCommand {
  @Command.String({required: false})
  name?: string;

  @Command.Boolean(`-v,--verbose`)
  verbose: boolean = false;

  @Command.Boolean(`--json`)
  json: boolean = false;

  static usage: Usage = Command.Usage({
    description: `get the path to a binary script`,
    details: `
      When used without arguments, this command will print the list of all the binaries available in the current workspace. Adding the \`-v,--verbose\` flag will cause the output to contain both the binary name and the locator of the package that provides the binary.

      When an argument is specified, this command will just print the path to the binary on the standard output and exit. Note that the reported path may be stored within a zip archive.

      If the \`--json\` flag is set the output will follow a JSON-stream output also known as NDJSON (https://github.com/ndjson/ndjson-spec).
    `,
    examples: [[
      `List all the available binaries`,
      `$0 bin`,
    ], [
      `Print the path to a specific binary`,
      `$0 bin eslint`,
    ]],
  });

  @Command.Path(`bin`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, locator} = await Project.find(configuration, this.context.cwd);

    await project.resolveEverything({
      lockfileOnly: true,
      report: new ThrowReport(),
    });

    if (this.name) {
      const binaries = await scriptUtils.getPackageAccessibleBinaries(locator, {project});

      const binary = binaries.get(this.name);
      if (!binary)
        throw new UsageError(`Couldn't find a binary named "${this.name}" for package "${structUtils.prettyLocator(configuration, locator)}"`);

      const [/*pkg*/, binaryFile] = binary;
      this.context.stdout.write(`${binaryFile}\n`);

      return 0;
    }

    const report = await StreamReport.start({
      configuration,
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      const binaries = await scriptUtils.getPackageAccessibleBinaries(locator, {project});

      const keys = Array.from(binaries.keys());
      const maxKeyLength = keys.reduce((max, key) => Math.max(max, key.length), 0);

      for (const [name, [pkg, binaryFile]] of binaries) {
        report.reportJson({
          name,
          source: structUtils.stringifyIdent(pkg),
          path: binaryFile,
        });
      }

      if (this.verbose) {
        for (const [name, [pkg]] of binaries) {
          report.reportInfo(null, `${name.padEnd(maxKeyLength, ` `)}   ${structUtils.prettyLocator(configuration, pkg)}`);
        }
      } else {
        for (const name of binaries.keys()) {
          report.reportInfo(null, name);
        }
      }
    });

    return report.exitCode();
  }
}
