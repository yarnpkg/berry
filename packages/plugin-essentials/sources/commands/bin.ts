import {CommandContext, Configuration, Project} from '@berry/core';
import {scriptUtils, structUtils}               from '@berry/core';
import {Command, UsageError}                    from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class BinCommand extends Command<CommandContext> {
  @Command.String({required: false})
  name?: string;

  @Command.Boolean(`-v,--verbose`)
  verbose: boolean = false;

  static usage = Command.Usage({
    description: `get the path to a binary script`,
    details: `
      When used without arguments, this command will print the list of all the binaries available in the current workspace. Adding the \`-v,--verbose\` flag will cause the output to contain both the binary name and the locator of the package that provides the binary.

      When an argument is specified, this command will just print the path to the binary on the standard output and exit. Note that the reported path may be stored within a zip archive.
    `,
    examples: [[
      `List all the available binaries`,
      `yarn bin`,
    ], [
      `Print the path to a specific binary`,
      `yarn bin eslint`,
    ]],
  });

  @Command.Path(`bin`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, locator} = await Project.find(configuration, this.context.cwd);

    const binaries = await scriptUtils.getPackageAccessibleBinaries(locator, {project});

    if (this.name) {
      const binary = binaries.get(this.name);
      if (!binary)
        throw new UsageError(`Couldn't find a binary named "${this.name}" for package "${structUtils.prettyLocator(configuration, locator)}"`);

      const [/*pkg*/, binaryFile] = binary;
      this.context.stdout.write(`${binaryFile}\n`);
    } else {
      const keys = Array.from(binaries.keys());
      const maxKeyLength = keys.reduce((max, key) => Math.max(max, key.length), 0);

      if (this.verbose) {
        for (const [name, [pkg]] of binaries) {
          this.context.stdout.write(`${name.padEnd(maxKeyLength, ` `)}   ${structUtils.prettyLocator(configuration, pkg)}\n`);
        }
      } else {
        for (const name of binaries.keys()) {
          this.context.stdout.write(`${name}\n`);
        }
      }
    }
  }
}
