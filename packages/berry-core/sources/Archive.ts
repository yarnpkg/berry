import {ZipFS}       from '@berry/zipfs';
import {chmod, move} from 'fs-extra';
import {dirname}     from 'path';
import {tmpNameSync} from 'tmp';

export class Archive {
  public readonly zip: ZipFS;

  static load(path: string) {
    return new Archive(new ZipFS(path));
  }

  static create() {
    return new Archive(new ZipFS(tmpNameSync(), {create: true}));
  }

  private constructor(zip: ZipFS) {
    this.zip = zip;
  }

  addFile(name: string, data: Buffer | string, options: {date?: Date} = {}) {
    this.zip.mkdirp(dirname(name));
    this.zip.writeFile(name, data);
  }

  readText(name: string): string {
    // @ts-ignore
    return this.zip.readFile(name, `utf8`);
  }

  readJson(name: string) {
    return JSON.parse(this.readText(name));
  }

  async move(destination: string) {
    const source = this.zip.close();
    
    await chmod(source, 0o644);
    await move(source, destination);
  }
}
