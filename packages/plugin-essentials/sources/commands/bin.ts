import {Configuration, PluginConfiguration, Project} from '@berry/core';
import {scriptUtils, structUtils}                    from '@berry/core';
import {UsageError}                                  from 'clipanion';
import {Writable}                                    from 'stream';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`bin [name] [-v,--verbose]`)
  .describe(`get the path to a binary script`)

  .detail(`
    When used without arguments, this command will print the list of all the binaries available in the current workspace. Adding the \`-v,--verbose\` flag will cause the output to contain both the binary name and the locator of the package that provides the binary.

    When an argument is specified, this command will just print the path to the binary on the standard output and exit. Note that the reported path may be stored within a zip archive.
  `)

  .example(
    `Lists all the available binaries`,
    `yarn bin`,
  )

  .example(
    `Prints the path to a specific binary`,
    `yarn bin eslint`,
  )

  .action(async ({cwd, stdout, name, verbose}: {cwd: string, stdout: Writable, name: string, verbose: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project, locator} = await Project.find(configuration, cwd);

    const binaries = await scriptUtils.getPackageAccessibleBinaries(locator, {project});

    if (name) {
      const binary = binaries.get(name);
      if (!binary)
        throw new UsageError(`Couldn't find a binary named "${name}" for package "${structUtils.prettyLocator(configuration, locator)}"`);

      const [pkg, binaryFile] = binary;
      stdout.write(`${binaryFile}\n`);
    } else {
      const keys = Array.from(binaries.keys());
      const maxKeyLength = keys.reduce((max, key) => Math.max(max, key.length), 0);

      if (verbose) {
        for (const [name, [pkg, binaryFile]] of binaries) {
          stdout.write(`${name.padEnd(maxKeyLength, ` `)}   ${structUtils.prettyLocator(configuration, pkg)}\n`);
        }
      } else {
        for (const name of binaries.keys()) {
          stdout.write(`${name}\n`);
        }
      }
    }
  });
