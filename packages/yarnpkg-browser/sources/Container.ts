import PromiseWorker   from 'promise-worker';

import ContainerWorker from './ContainerWorker';

export class Container {
  private workers?: {
    main: Worker;
    async: PromiseWorker;
  };

  async open() {
    const worker = new ContainerWorker();

    this.workers = {
      main: worker,
      async: new PromiseWorker(worker),
    };

    this.workers.main.addEventListener(`message`, e => {
      this.process(e);
    });

    return this.workers.async.postMessage({
      type: `setup`,
    });
  }

  async reset(filesystem: Record<string, string>) {
    if (typeof this.workers === `undefined`)
      throw new Error(`No worker defined`);

    return this.workers.async.postMessage({
      type: `reset`,
      filesystem,
    });
  }

  async spawn(path: string, argv: Array<string>, {cwd}: {cwd: string}) {
    if (typeof this.workers === `undefined`)
      throw new Error(`No worker defined`);

    return this.workers.async.postMessage({
      type: `spawn`,
      path,
      argv,
      cwd,
    });
  }

  async eval(source: string, {cwd}: {cwd: string}) {
    if (typeof this.workers === `undefined`)
      throw new Error(`No worker defined`);

    return this.workers.async.postMessage({
      type: `source`,
      source,
      cwd,
    });
  }

  async list() {
    if (typeof this.workers === `undefined`)
      throw new Error(`No worker defined`);

    return this.workers.async.postMessage({
      type: `list`,
    });
  }

  private process(e: MessageEvent) {
    switch (e.data.type) {
      case `stdout`: {
        console.log(uint8ToString(e.data.data));
      } break;
    }
  }
}

function uint8ToString(data: Uint8Array) {
  return new TextDecoder(`utf8`).decode(data);
}
