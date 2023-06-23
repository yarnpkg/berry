import {parentPort}  from 'worker_threads';

import * as tgzUtils from '../tgzUtils';

export type ConvertToZipPayload = {
  tgz: Buffer | Uint8Array;
  opts: tgzUtils.ExtractBufferOptions;
};

if (!parentPort)
  throw new Error(`Assertion failed: Expected parentPort to be set`);

parentPort.on(`message`, async (data: ConvertToZipPayload) => {
  const {opts, tgz} = data;

  const tgzBuffer = Buffer.from(tgz.buffer, tgz.byteOffset, tgz.byteLength);
  await tgzUtils.convertToZipNoWorker(tgzBuffer, opts);

  parentPort!.postMessage(true);
});
