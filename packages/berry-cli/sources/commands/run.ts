import execa = require('execa');

import {Configuration, Project, Workspace, Cache, Locator} from '@berry/core';
import {runShell}                                          from '@berry/shell'
// @ts-ignore: Need to write the definition file
import {UsageError, flags}                                 from '@manaflair/concierge';
import {resolve}                                           from 'path';
import {Readable, Writable}                                from 'stream';

import {plugins}                                           from '../plugins';

async function getDependencyBinaries({configuration, project, workspace, cache}: {configuration: Configuration, project: Project, workspace: Workspace, cache: Cache}) {
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

     const manifest = await project.getPackageManifest(pkg, {cache});

     for (const [binName, file] of manifest.bin.entries()) {
       binaries.set(binName, [pkg, file]);
     }
   }

   return binaries;
}

export default (concierge: any) => concierge

  .command(`run <name> [... args]`)
  .describe(`run a script defined in the package.json`)
  .flags({proxyArguments: true})

  .action(async ({stdin, stdout, stderr, name, args}: {stdin: Readable, stdout: Writable, stderr: Writable, name: string, args: Array<string>}) => {
    const configuration = await Configuration.find(process.cwd(), plugins);
    const {project, workspace} = await Project.find(configuration, process.cwd());
    const cache = await Cache.find(configuration);

    const script = workspace.manifest.scripts.get(name);

    if (script) {
      try {
        await runShell(script, {args: args, stdin, stdout, stderr});
        return 0;
      } catch {
        return 1;
      }
    }

    const binaries = await getDependencyBinaries({configuration, project, workspace, cache});
    const binary = binaries.get(name);

    if (binary) {
      const [pkg, file] = binary;

      const root = await project.getPackageLocation(pkg, {cache});
      const target = resolve(root, file);

      const stdio: Array<any> = [`pipe`, `pipe`, `pipe`];

      if (stdin === process.stdin)
        stdio[0] = stdin;
      if (stdout === process.stdout)
        stdio[1] = stdout;
      if (stderr === process.stderr)
        stdio[2] = stderr;

      try {
        const subprocess = execa(process.execPath, [`-r`, configuration.pnpPath, target, ... args], {stdio});

        if (stdin !== process.stdin)
          stdin.pipe(subprocess.stdin);
        if (stdout !== process.stdout)
          subprocess.stdout.pipe(stdout);
        if (stderr !== process.stderr)
          subprocess.stderr.pipe(stderr);

        return 0;
      } catch (error) {
        return 1;
      }
    }

    throw new UsageError(`Couldn't find a script named "${name}"`);
  });
