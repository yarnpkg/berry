import {parentPort}                              from 'worker_threads';

import {convertToZipWorker, ConvertToZipPayload} from '../tgzUtils';


if (!parentPort)
  throw new Error(`Assertion failed: Expected parentPort to be set`);


parentPort.on(`message`, async (data: ConvertToZipPayload) => {
  await convertToZipWorker(data);
  parentPort!.postMessage(data.tmpFile);
});
