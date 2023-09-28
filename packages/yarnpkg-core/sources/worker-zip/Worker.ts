import {parentPort}                              from 'worker_threads';

import {convertToZipWorker, ConvertToZipPayload} from '../tgzUtils';


if (!parentPort)
  throw new Error(`Assertion failed: Expected parentPort to be set`);

parentPort.on(`message`, async (data: ConvertToZipPayload) => {
  parentPort!.postMessage(await convertToZipWorker(data));
});
