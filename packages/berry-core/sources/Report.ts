import {Cache}   from './Cache';
import {Project} from './Project';

export class Report {
  private readonly project: Project;
  private readonly cache: Cache;

  static async start({project, cache}: {project: Project, cache: Cache}, cb: () => Promise<any>) {
    const report = new Report({project, cache});
    await report.setup();

    await cb();

    return await report.finalize();
  }

  constructor({project, cache}: {project: Project, cache: Cache}) {
    this.project = project;
    this.cache = cache;
  }

  async setup() {
  }

  async finalize() {
    return `Done.`;
  }
}
