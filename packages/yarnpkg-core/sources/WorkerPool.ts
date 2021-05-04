import {cpus}   from 'os';
import PQueue   from 'p-queue';
import {Worker} from 'worker_threads';

export class WorkerPool<TIn, TOut> {
  private pool: Array<Worker> = [];
  private queue = new PQueue({
    concurrency: cpus().length,
  });

  constructor(private source: string) {
    const timeout = setTimeout(() => {
      if (this.queue.size !== 0 || this.queue.pending !== 0)
        return;

      for (const worker of this.pool)
        worker.terminate();

      this.pool = [];
    }, 1000).unref();

    this.queue.on(`idle`, () => {
      timeout.refresh();
    });
  }

  run(data: TIn) {
    return this.queue.add(() => {
      const worker = this.pool.pop() ?? new Worker(this.source, {
        eval: true,
        execArgv: [...process.execArgv, `--unhandled-rejections=strict`],
      });
      worker.ref();

      return new Promise<TOut>((resolve, reject) => {
        const exitHandler = (code: number) => {
          if (code !== 0) {
            reject(new Error(`Worker exited with code ${code}`));
          }
        };

        worker.once(`message`, (result: TOut) => {
          this.pool.push(worker);
          worker.unref();
          worker.off(`error`, reject);
          worker.off(`exit`, exitHandler);
          resolve(result);
        });
        worker.once(`error`, reject);
        worker.once(`exit`, exitHandler);
        worker.postMessage(data);
      });
    });
  }
}
