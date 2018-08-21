import {Configuration, Cache, Project, Report} from '@berry/core';
import {structUtils}                           from '@berry/core';
import {Command, flags}                        from '@oclif/command'

export default class Remove extends Command {
  static description = 'remove dependencies from the project';

  static examples = [
    `$ berry add lodash
     Added 1 dependency, 42 packages added into the cache (0MiB ~ 10MiB).`,
  ];

  static flags = {
  };

  static args = [
  ];

  static strict = false;

  async run() {
    const {args, flags, argv} = this.parse(Remove);

    const configuration = await Configuration.find(process.cwd());
    const {project, workspace} = await Project.find(configuration, process.cwd());
    const cache = await Cache.find(configuration);

    const report = await Report.start({project, cache}, async () => {

      for (const entry of argv) {
        const ident = structUtils.parseIdent(entry);
        workspace.removeDependency(ident);
      }

      await project.install({cache});
      await project.persist();

    });

    process.stdout.write(`${report}\n`);
  }
}
