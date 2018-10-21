import execa = require('execa');

import {Configuration, Project, Workspace, Cache, Locator, Manifest} from '@berry/core';
import {runShell}                                                    from '@berry/shell'
// @ts-ignore: Need to write the definition file
import {UsageError}                                                  from '@manaflair/concierge';
import {resolve}                                                     from 'path';
import {Readable, Writable}                                          from 'stream';

import {plugins}                                                     from '../plugins';

import {getDependencyBinaries}                                       from './bin';

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

      const fetcher = configuration.makeFetcher();
      const pkgFs = await fetcher.fetch(pkg, {cache, fetcher, project});
      const target = resolve(pkgFs.getRealPath(), file);

      const stdio: Array<any> = [`pipe`, `pipe`, `pipe`];

      if (stdin === process.stdin)
        stdio[0] = stdin;
      if (stdout === process.stdout)
        stdio[1] = stdout;
      if (stderr === process.stderr)
        stdio[2] = stderr;

      try {
        const subprocess = execa(process.execPath, [`--require`, configuration.pnpPath, target, ... args], {stdio});

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
