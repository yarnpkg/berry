import {ZipOpenFS, PortablePath} from '@yarnpkg/fslib';
import {getLibzipSync}           from '@yarnpkg/libzip';
import {posix}                   from 'path';
import * as vscode               from 'vscode';

export class ZipFSProvider implements vscode.FileSystemProvider {
  private readonly zipFs = new ZipOpenFS({
    libzip: getLibzipSync(),
    useCache: false,
  });

  stat(uri: vscode.Uri): vscode.FileStat {
    const stat: any = this.zipFs.statSync(uri.path as PortablePath);

    switch (true) {
      case stat.isDirectory(): {
        stat.type = vscode.FileType.Directory;
      } break;

      case stat.isFile(): {
        stat.type = vscode.FileType.File;
      } break;

      default: {
        stat.type = vscode.FileType.Unknown;
      } break;
    }

    return stat;
  }

  readDirectory(uri: vscode.Uri): Array<[string, vscode.FileType]> {
    const listing = this.zipFs.readdirSync(uri.path as PortablePath);
    const results = [];

    for (const entry of listing) {
      const entryStat = this.zipFs.statSync(posix.join(uri.path, entry) as PortablePath);

      if (entryStat.isDirectory()) {
        results.push([entry, vscode.FileType.Directory] as [string, vscode.FileType]);
      } else {
        results.push([entry, vscode.FileType.File] as [string, vscode.FileType]);
      }
    }

    return results;
  }

  readFile(uri: vscode.Uri): Uint8Array {
    return this.zipFs.readFileSync(uri.path as PortablePath);
  }

  writeFile(uri: vscode.Uri, content: Uint8Array, options: {create: boolean, overwrite: boolean}): void {
    if (!options.create && !this.zipFs.existsSync(uri.path as PortablePath))
      throw new Error(``);
    if (options.create && !options.overwrite && this.zipFs.existsSync(uri.path as PortablePath))
      throw new Error(``);

    this.zipFs.writeFileSync(uri.path as PortablePath, new Buffer(content));
  }

  rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {
    throw new Error(`Not supported`);
  }

  delete(uri: vscode.Uri): void {
    throw new Error(`Not supported`);
  }

  createDirectory(uri: vscode.Uri): void {
    this.zipFs.mkdirSync(uri.path as PortablePath);
  }

  private _emitter = new vscode.EventEmitter<Array<vscode.FileChangeEvent>>();
  readonly onDidChangeFile = this._emitter.event;

  watch(resource: vscode.Uri, opts: any): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }
}
