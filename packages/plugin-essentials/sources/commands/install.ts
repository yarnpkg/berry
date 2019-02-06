import {WorkspaceRequiredError}                              from '@berry/cli';
import {Configuration, Cache, Plugin, Project, StreamReport} from '@berry/core';
import {Writable}                                            from 'stream';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`install [-f]`)
  .describe(`install the project dependencies`)

  .detail(`
    This command setup your project if needed. The installation is splitted in four different steps that each have their own characteristics:

    - Resolution: First the package manager will resolve your dependencies. The exact way a dependency version is privileged over another isn't standardized outside of the regular semver guarantees. If a package doesn't resolve to what you would expect, check that all dependencies are correctly declared (also check our website for more information: ).

    - Fetch: Then we download all the dependencies if needed, and make sure that they're all stored within our cache (check the value of \`cache-folder\` in \`yarn config\` to see where are stored the cache files).

    - Link: Then we send the dependency tree information to internal plugins tasked from writing them on the disk in some form (for example by generating the .pnp.js file you might know).

    - Build: Once the dependency tree has been written on the disk, the package manager will now be free to run the build scripts for all packages that might need it, in a topological order compatible with the way they depend on one another.

    Note that running this command is not part of the recommended workflow. Yarn supports zero-installs, which means that as long as you store your cache and your .pnp.js file inside your repository, everything will work without requiring any install right after cloning your repository or switching branches.
  `)

  .example(
    `Installs the project`,
    `yarn install`,
  )

  .action(async ({cwd, stdout}: {cwd: string, stdout: Writable}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(cwd);

    // Important: Because other commands also need to run installs, if you
    // get in a situation where you need to change this file in order to
    // customize the install it's very likely you're doing something wrong.
    // This file should stay super super simple, and the configuration and
    // install logic should be implemented elsewhere (probably in either of
    // the Configuration and Install classes). Feel free to open an issue
    // in order to ask for design feedback before writing features.

    const report = await StreamReport.start({configuration, stdout}, async (report: StreamReport) => {
      await project.install({cache, report});
    });

    return report.exitCode();
  });
