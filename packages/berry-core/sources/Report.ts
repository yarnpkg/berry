import {Cache}   from './Cache';
import {Project} from './Project';

export class Report {
  private readonly project: Project;
  private readonly cache: Cache;

  private startTime: number = 0;
  private cacheHitStart: number = 0;
  private cacheMissStart: number = 0;

  private messages: Array<string> = [];
  private messageSet: Set<string> = new Set();

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
    this.startTime = Date.now();
    this.cacheHitStart = this.cache.cacheHitCount;
    this.cacheMissStart = this.cache.cacheMissCount;

    this.messages = [];
    this.messageSet = new Set();
  }

  log(message: string) {
    this.messages.push(message);
    this.messageSet.add(message);
  }

  logOnce(message: string) {
    if (this.messageSet.has(message))
      return;

    this.log(message);
  }

  async finalize() {
    const finalTime = Date.now() - this.startTime;
    const cacheHitCount = this.cache.cacheHitCount - this.cacheHitStart;
    const cacheMissCount = this.cache.cacheMissCount - this.cacheMissStart;

    const timing = finalTime < 60 * 1000
      ? `${Math.round(finalTime / 10) / 100}s`
      : `${Math.round(finalTime / 600) / 100}m`;

    let fetchStatus = ``;

    if (cacheHitCount > 1) {
      fetchStatus += ` - ${cacheHitCount} packages were already cached`;
    } else if (cacheHitCount === 1) {
      fetchStatus += ` - one package was already cached`;
    }

    if (cacheHitCount > 0) {
      if (cacheMissCount > 1) {
        fetchStatus += `, ${cacheMissCount} had to be fetched`;
      } else if (cacheMissCount === 1) {
        fetchStatus += `, one had to be fetched`;
      }
    } else {
      if (cacheMissCount > 1) {
        fetchStatus += ` - ${cacheMissCount} packages had to be fetched`;
      } else if (cacheMissCount === 1) {
        fetchStatus += ` - one package had to be fetched`;
      }
    }

    const withErrors = this.project.errors.length > 0
      ? ` with errors`
      : ``;
    
    let result = ``;

    for (const error of this.project.errors)
      result += `${error.message}\n`;

    result += `Done${withErrors} in ${timing}${fetchStatus}.\n`;

    return result;
  }
}
