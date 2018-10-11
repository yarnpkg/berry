import {posix}   from 'path';

import {Archive} from './Archive';
import {Parse}   from 'tar';

interface MakeArchiveOptions {
  prefixPath?: string | null,
  stripComponents?: number,
};

export async function makeArchive(tgz: Buffer, {stripComponents = 0, prefixPath = null}: MakeArchiveOptions = {}): Promise<Archive> {
  const now = new Date();

  const archive = new Archive();

  // @ts-ignore: Typescript doesn't want me to use new
  const parser = new Parse();

  function ignore(entry: any) {
    // Disallow absolute paths; might be malicious (ex: /etc/passwd)
    if (entry[0] === `/`)
      return true;

    const parts = entry.path.split(/\//g);

    // Same rule than for absolute paths
    if (parts.some((part: string) => part === `..`))
      return true;

    if (parts.length <= stripComponents)
      return true;

    return false;
  }

  parser.on(`entry`, (entry: any) => {
    if (ignore(entry)) {
      entry.resume();
      return;
    }

    const parts = entry.path.split(/\//g);
    const mappedPath = posix.join(prefixPath || `.`, parts.slice(stripComponents).join(`/`));

    const chunks: Array<Buffer> = [];

    entry.on(`data`, (chunk: Buffer) => {
      chunks.push(chunk);
    });

    entry.on(`end`, () => {
      archive.addFile(mappedPath, Buffer.concat(chunks), {
        date: now,
      });
    });
  });

  return await new Promise<Archive>((resolve, reject) =>  {
    parser.on(`error`, (error: Error) => {
      reject(error);
    });

    parser.on(`close`, () => {
      resolve(archive);
    });

    parser.end(tgz);
  });
}
