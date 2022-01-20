import {PortablePath, ZipFS}                    from '@yarnpkg/fslib';
import {getLibzipPromise}                       from '@yarnpkg/libzip';
import {parentPort}                             from 'worker_threads';

import {extractArchiveTo, ExtractBufferOptions} from '../tgzUtils';

export type ConvertToZipPayload = {tmpFile: PortablePath, tgz: Buffer | Uint8Array, opts: ExtractBufferOptions};

if (!parentPort)
  throw new Error(`Assertion failed: Expected parentPort to be set`);

parentPort.on(`message`, async (data: ConvertToZipPayload) => {
  const {opts, tgz, tmpFile} = data;
  const {compressionLevel, ...bufferOpts} = opts;

  const zipFs = new ZipFS(tmpFile, {create: true, libzip: await getLibzipPromise(), level: compressionLevel});

  // Buffers sent through Node are turned into regular Uint8Arrays
  const tgzBuffer = Buffer.from(tgz.buffer, tgz.byteOffset, tgz.byteLength);
  await extractArchiveTo(tgzBuffer, zipFs, bufferOpts);

  zipFs.saveAndClose();

  parentPort!.postMessage(data.tmpFile);
});
