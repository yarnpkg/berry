import path                  from 'path';
import registerPromiseWorker from 'promise-worker/register';

// @ts-ignore
globalThis.global = globalThis;
// @ts-ignore
globalThis.Buffer = require(`buffer/`).Buffer;

function makeRequire(builtins: Map<string, any>) {
  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return function require(moduleName: string) {
    const res = builtins.get(moduleName);
    if (typeof res === `undefined`)
      throw new Error(`Unbound module: ${moduleName}`);

    return res;
  };
}

async function setup() {
  const zlib = require(`browserify-zlib`);
  zlib.brotliDecompressSync = require(`brotli/decompress`);

  const builtins: Map<string, any> = new Map([
    [`assert`, require(`assert/`)],
    [`buffer`, require(`buffer/`)],
    [`child_process`, require(`./polyfills/child_process`)],
    [`crypto`, require(`crypto-browserify`)],
    [`events`, require(`events/`)],
    [`fs`, require(`./polyfills/fs`)],
    [`https`, require(`./polyfills/http`)],
    [`http`, require(`./polyfills/http`)],
    [`module`, require(`./polyfills/module`)],
    [`net`, require(`./polyfills/http`)],
    [`os`, require(`os-browserify`)],
    [`path`, require(`path/`)],
    [`querystring`, require(`querystring/`)],
    [`stream`, require(`stream-browserify`)],
    [`string_decoder`, require(`string_decoder/`)],
    [`tls`, require(`./polyfills/http`)],
    [`tty`, require(`tty-browserify`)],
    [`url`, require(`url/`)],
    [`util`, require(`util/`)],
    [`v8`, require(`./polyfills/v8`)],
    [`vm`, require(`vm-browserify`)],
    [`zlib`, zlib],
  ]);

  process.stdout.on(`data`, data => {
    self.postMessage({
      type: `stdout`,
      data,
    });
  });

  return {
    module: {exports: {}},
    require: makeRequire(builtins),
    builtins,
    process,
  };
}

type Await<T> = T extends PromiseLike<infer U> ? U : T;
let context: Await<ReturnType<typeof setup>> | null = null;

let queue = Promise.resolve();

async function enqueue(cb: (message: any) => Promise<void>, message: any) {
  return queue = queue.then(() => cb(message)).catch(err => {
    self.postMessage({type: `error`, stack: err.stack});
    throw err;
  });
}

const commands = new Map([
  [`setup`, async function setupCommand(message: any) {
    context = await setup();
  }],

  [`reset`, async function resetCommand(message: any) {
    const {builtins, process} = context!;

    process.chdir(`/`);

    builtins.set(`fs`, require(`fs`).resetVolume(message.filesystem));
  }],

  [`spawn`, async function spawnCommand(message: any) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {module, require, process} = context!;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const __filename = path.normalize(message.path), __dirname = path.dirname(__filename);

    process.argv = [`node`, __filename, ...message.argv];
    process.chdir(message.cwd);

    // @ts-ignore
    const setTimeout = process.setTimeout;
    // @ts-ignore
    const clearTimeout = process.clearTimeout;

    eval(require(`fs`).readFileSync(__filename, `utf8`));
  }],

  [`eval`, async function evalCommand(message: any) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {module, require, process} = context!;

    process.argv = [`node`, ...message.argv];
    process.chdir(message.cwd);

    eval(message.source);
  }],

  [`list`, async function listCommand(message: any) {
    const {require} = context!;

    return require(`fs`).serializeVolume();
  }],
]);

registerPromiseWorker(async (message: any) => {
  const handler = commands.get(message.type);
  if (typeof handler === `undefined`)
    throw new Error(`No command handler for ${message.type}`);

  return enqueue(handler, message);
});

const worker = null as any as {new(): Worker};
// eslint-disable-next-line arca/no-default-export
export default worker;
