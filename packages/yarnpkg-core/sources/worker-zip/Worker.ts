import {parentPort}                            from 'worker_threads';

import {ConvertToZipPayload, convertToZipImpl} from './convert';

if (!parentPort)
  throw new Error(`Assertion failed: Expected parentPort to be set`);

parentPort.on(`message`, async (data: ConvertToZipPayload) => {
  parentPort!.postMessage(await convertToZipImpl(data));
});
