import JSZip = require('jszip');

import {createWriteStream, readFile} from 'fs';
import {promisify}                   from 'util';

import {Manifest}                    from './Manifest';

const readFileP = promisify(readFile);

export class Archive {
  public readonly zip: JSZip;

  static async load(path: string) {
    const zip = new JSZip();

    const content = await readFileP(path);
    await zip.loadAsync(content);

    return new Archive(zip);
  }

  constructor(zip: JSZip | null = null) {
    this.zip = zip || new JSZip();
  }

  addFile(name: string, data: string | Buffer | NodeJS.ReadableStream, options: {date?: Date} = {}) {
    this.zip.file(name, data, options);
  }

  async getPackageManifest() {
    const source = await this.zip.file(`package.json`).async(`text`);
    const data = JSON.parse(source);

    const manifest = new Manifest();
    manifest.load(data);

    // Since it comes from an archive, it's immutable and we freeze its content
    Object.freeze(manifest);

    return manifest;
  }

  async store(target: string) {
    const stream = this.zip.generateNodeStream({type: 'nodebuffer', streamFiles: true})
      .pipe(createWriteStream(target));

    await new Promise((resolve, reject) => {
      stream.on(`error`, error => {
        reject(error);
      });
      stream.on(`finish`, () => {
        resolve();
      });
    });
  }
}
