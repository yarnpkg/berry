import {cpus}   from 'os';
import PQueue   from 'p-queue';
import {Worker} from 'worker_threads';

const kTaskInfo = Symbol(`kTaskInfo`);

type PoolWorker<TOut> = Worker & {[kTaskInfo]: null | {resolve: (value: TOut) => void, reject: (reason?: any) => void}};

export class WorkerPool<TIn, TOut> {
  private pool: Array<PoolWorker<TOut>> = [];
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

    this.queue.on(`idle`, () => {
      timeout.refresh();
    });
  }

  private createWorker() {
    const worker = new Worker(this.source, {
      eval: true,
      execArgv: [...process.execArgv, `--unhandled-rejections=strict`],
    }) as PoolWorker<TOut>;

    worker.on(`message`, (result: TOut) => {
      if (!worker[kTaskInfo])
        throw new Error(`Assertion failed: Worker sent a message without having a task assigned`);

      worker[kTaskInfo]!.resolve(result);
      worker[kTaskInfo] = null;

      worker.unref();
      this.pool.push(worker);
    });

    worker.on(`error`, err => {
      worker[kTaskInfo]?.reject(err);
      worker[kTaskInfo] = null;
    });

    worker.on(`exit`, code => {
      if (code !== 0)
        worker[kTaskInfo]?.reject(new Error(`Worker exited with code ${code}`));

      worker[kTaskInfo] = null;
    });

    return worker;
  }

  run(data: TIn) {
    return this.queue.add(() => {
      const worker = this.pool.pop() ?? this.createWorker();
      worker.ref();

      return new Promise<TOut>((resolve, reject) => {
        worker[kTaskInfo] = {resolve, reject};
        worker.postMessage(data);
      });
    });
  }
}
