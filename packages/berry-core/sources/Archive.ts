import JSZip = require('jszip');

import {createWriteStream, readFile} from 'fs';
import {promisify}                   from 'util';

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

  async readText(name: string) {
    const file = this.zip.file(name);

    if (!file)
      throw new Error(`File entry not found (${name})`);

    return await file.async(`text`);
  }

  async readJson(name: string) {
    return JSON.parse(await this.readText(name));
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
