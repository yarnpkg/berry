import {BaseCommand}                                                    from '@yarnpkg/cli';
import {Configuration, Project, scriptUtils, StreamReport, structUtils} from '@yarnpkg/core';
import {Command, Option, Usage}                                         from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class BinCommand extends BaseCommand {
  static paths = [
    [`bin`],
  ];

  static usage: Usage = Command.Usage({
    description: `get the path to a binary script`,
    details: `
      When used without arguments, this command will print the list of all the binaries available in the current workspace. Adding the \`-v,--verbose\` flag will cause the output to contain both the binary name and the locator of the package that provides the binary.

      When an argument is specified, this command will just print the path to the binary on the standard output and exit. Note that the reported path may be stored within a zip archive.
    `,
    examples: [[
      `List all the available binaries`,
      `$0 bin`,
    ], [
      `Print the path to a specific binary`,
      `$0 bin eslint`,
    ]],
  });

  verbose = Option.Boolean(`-v,--verbose`, false, {
    description: `Print both the binary name and the locator of the package that provides the binary`,
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  topLevel = Option.Boolean(`-T,--top-level`, false, {
    description: `Check the root workspace for binaries instead of the current one`,
  });

  currentWorkspaceOnly = Option.Boolean(`-C,--current-workspace-only`, false, {
    description: `Stick to the current workspace for binaries and do not look elsewhere if unavailable`,
  });

  name = Option.String({required: false});

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, locator} = await Project.find(configuration, this.context.cwd);
    const topLevelLocator = project.topLevelWorkspace.anchoredLocator;
    const effectiveLocator = this.topLevel ? topLevelLocator : locator;

    await project.restoreInstallState();

    if (this.name) {
      const binaries = await scriptUtils.getPackageAccessibleBinaries(effectiveLocator, {project, currentWorkspaceOnly: this.currentWorkspaceOnly, topLevel: this.topLevel});

      const binary = binaries.get(this.name);
      if (!binary) {
        console.error(`Couldn't find a binary named "${this.name}" for package "${structUtils.prettyLocator(configuration, effectiveLocator)}"`);
        return 1;
      }

      const [/*pkg*/, binaryFile] = binary;
      this.context.stdout.write(`${binaryFile}\n`);

      return 0;
    }

    const report = await StreamReport.start({
      configuration,
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      const binaries = await scriptUtils.getPackageAccessibleBinaries(locator, {project, currentWorkspaceOnly: this.currentWorkspaceOnly, topLevel: this.topLevel});

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
