import {cpus}   from 'os';
import PQueue   from 'p-queue';
import {Worker} from 'worker_threads';

export class WorkerPool<TIn, TOut> {
  private pool: Array<Worker> = [];
  private queue = new PQueue({
    concurrency: Math.max(1, cpus().length),
  });

  constructor(private source: string) {
    const timeout = setTimeout(() => {
      if (this.queue.size !== 0 || this.queue.pending !== 0)
        return;

      for (const worker of this.pool)
        worker.terminate();

      this.pool = [];
    }, 1000).unref();

    process.on(`exit`, () => {
      for (const worker of this.pool) {
        worker.terminate();
      }
    });

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

      return new Promise<TOut>((resolve, reject) => {
        const exitHandler = (code: number) => {
          if (code !== 0) {
            reject(new Error(`Worker exited with code ${code}`));
          }
        };

        // Used to hold the execution until the worker returns; can't
        // use `ref`/`unref` from the worker, because StackBlitz hangs
        // on it: https://github.com/stackblitz/webcontainer-core/issues/365
        const timeout = setTimeout(() => {}, 0x7FFFFFFF);

        worker.once(`message`, (result: TOut) => {
          this.pool.push(worker);

          worker.off(`error`, reject);
          worker.off(`exit`, exitHandler);

          clearTimeout(timeout);

          resolve(result);
        });

        worker.once(`error`, reject);
        worker.once(`exit`, exitHandler);

        worker.unref();
        worker.postMessage(data);
      });
    });
  }
}
