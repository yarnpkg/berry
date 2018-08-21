import {Configuration, Cache, Project, Report} from '@berry/core';
import {structUtils}                           from '@berry/core';
import {Command, flags}                        from '@oclif/command'

export default class Install extends Command {
  static description = 'install the project dependencies';

  static examples = [
    `$ berry install
     Installed 42 packages, 10 added into the cache (42MiB ~> 58MiB).`,
  ];

  static flags = {
  };

  static args = [
  ];

  async run() {
    const {args, flags, argv} = this.parse(Install);

    const configuration = await Configuration.find(process.cwd());
    const {project, workspace} = await Project.find(configuration, process.cwd());
    const cache = await Cache.find(configuration);

    const report = await Report.start({project, cache}, async () => {
      await project.install({cache});
      await project.persist();
    });

    process.stdout.write(report);
  }
}
