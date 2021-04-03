import {PortablePath, ZipFS}                    from '@yarnpkg/fslib';
import {getLibzipPromise}                       from '@yarnpkg/libzip';
import {parentPort}                             from 'worker_threads';

import {extractArchiveTo, ExtractBufferOptions} from './tgzUtils';

export type ConvertToZipPayload = {tmpFile: PortablePath, tgz: Buffer, opts: ExtractBufferOptions};

if (!parentPort)
  throw new Error(`Expected parentPort to be set`);

parentPort.on(`message`, async (data: ConvertToZipPayload) => {
  const {opts, tgz, tmpFile} = data;
  const {compressionLevel, ...bufferOpts} = opts;

  try {
    const zipfs = await extractArchiveTo(Buffer.from(tgz), new ZipFS(tmpFile, {create: true, libzip: await getLibzipPromise(), level: compressionLevel}), bufferOpts);
    zipfs.saveAndClose();
    parentPort!.postMessage(data.tmpFile);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
});
