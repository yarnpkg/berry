import {Configuration, Project, Workspace, Cache, Locator, Manifest} from '@berry/core';
// @ts-ignore: Need to write the definition file
import {UsageError}                                                  from '@manaflair/concierge';
import {resolve}                                                     from 'path';
import {Writable}                                                    from 'stream';

import {plugins}                                                     from '../plugins';

export async function getDependencyBinaries({configuration, project, workspace, cache}: {configuration: Configuration, project: Project, workspace: Workspace, cache: Cache}) {
  const fetcher = configuration.makeFetcher();
  const binaries: Map<string, [Locator, string]> = new Map();

  const descriptors = [
    ... workspace.manifest.dependencies.values(),
    ... workspace.manifest.devDependencies.values(),
    ... workspace.manifest.peerDependencies.values(),
  ];

  for (const descriptor of descriptors) {
    const resolution = project.storedResolutions.get(descriptor.descriptorHash);

    if (!resolution)
      continue;

    const pkg = project.storedPackages.get(resolution);

    if (!pkg)
      continue;

    const pkgFs = await fetcher.fetch(pkg, {cache, fetcher, project});

    const manifest = new Manifest();
    manifest.loadFile(pkgFs);

    for (const [binName, file] of manifest.bin.entries()) {
      binaries.set(binName, [pkg, file]);
    }
  }

  return binaries;
}

export default (concierge: any) => concierge

  .command(`bin <name>`)
  .describe(`get the path to a binary script`)

  .action(async ({cwd, stdout, name}: {cwd: string, stdout: Writable, name: string}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    const binaries = await getDependencyBinaries({configuration, project, workspace, cache});
    const binary = binaries.get(name);

    if (!binary)
      throw new UsageError(`Couldn't find a binary named "${name}"`);

    const [pkg, file] = binary;

    const fetcher = configuration.makeFetcher();
    const pkgFs = await fetcher.fetch(pkg, {cache, fetcher, project});
    const target = resolve(pkgFs.getRealPath(), file);

    stdout.write(`${target}\n`);
  });
