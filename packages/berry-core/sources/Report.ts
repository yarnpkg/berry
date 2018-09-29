import {Cache}   from './Cache';
import {Project} from './Project';

export class Report {
  private readonly project: Project;
  private readonly cache: Cache;

  private cacheHitStart: number = 0;
  private cacheMissStart: number = 0;

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
    this.cacheHitStart = this.cache.cacheHitCount;
    this.cacheMissStart = this.cache.cacheMissCount;
  }

  async finalize() {
    const cacheHitCount = this.cache.cacheHitCount - this.cacheHitStart;
    const cacheMissCount = this.cache.cacheMissCount - this.cacheMissStart;

    const parts = [];

    if (cacheHitCount > 1) {
      parts.push(`${cacheHitCount} packages were already cached`);
    } else if (cacheHitCount === 1) {
      parts.push(`one package was already cached`);
    }

    if (cacheMissCount > 1) {
      parts.push(`${cacheMissCount} packages had to be fetched`);
    } else if (cacheMissCount === 1) {
      parts.push(`one package had to be fetched`);
    }

    return `Done${parts.map(part => ` - ${part}`).join(``)}.`;
  }
}
