import {ZipOpenFS, VirtualFS, PosixFS, npath} from '@yarnpkg/fslib';
import {getLibzipSync}                        from '@yarnpkg/libzip';
import * as vscode                            from 'vscode';

import {parseUri}                             from './index';

export class ZipFSProvider implements vscode.FileSystemProvider {
  private readonly fs = new PosixFS(
    new VirtualFS({
      baseFs: new ZipOpenFS({
        libzip: getLibzipSync(),
        useCache: true,
        maxOpenFiles: 80,
      }),
    })
  );

  stat(uri: vscode.Uri): vscode.FileStat {
    const stat: any = this.fs.statSync(parseUri(uri));

    switch (true) {
      case stat.isDirectory():
      case npath.extname(parseUri(uri)) === `.zip`: {
        stat.type = vscode.FileType.Directory;
      } break;

      case stat.isFile(): {
        stat.type = vscode.FileType.File;
      } break;

      case stat.isSymbolicLink(): {
        stat.type = vscode.FileType.SymbolicLink;
      } break;

      default: {
        stat.type = vscode.FileType.Unknown;
      } break;
    }

    return stat;
  }

  readDirectory(uri: vscode.Uri): Array<[string, vscode.FileType]> {
    const listing = this.fs.readdirSync(parseUri(uri));

    return listing.map(entry => {
      const {type} = this.stat(vscode.Uri.joinPath(uri, entry));
      return [entry, type];
    });
  }

  readFile(uri: vscode.Uri): Uint8Array {
    return this.fs.readFileSync(parseUri(uri));
  }

  writeFile(uri: vscode.Uri, content: Uint8Array, options: {create: boolean, overwrite: boolean}): void {
    if (!options.create && !this.fs.existsSync(parseUri(uri)))
      throw vscode.FileSystemError.FileNotFound(uri);
    if (options.create && !options.overwrite && this.fs.existsSync(parseUri(uri)))
      throw vscode.FileSystemError.FileExists(uri);

    this.fs.writeFileSync(parseUri(uri), Buffer.from(content));
  }

  rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {
    throw new Error(`Not supported`);
  }

  delete(uri: vscode.Uri, options: {recursive: boolean}): void {
    this.fs.removeSync(parseUri(uri), options);
  }

  createDirectory(uri: vscode.Uri): void {
    this.fs.mkdirSync(parseUri(uri));
  }

  private _emitter = new vscode.EventEmitter<Array<vscode.FileChangeEvent>>();
  readonly onDidChangeFile = this._emitter.event;

  watch(resource: vscode.Uri, opts: any): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }
}
