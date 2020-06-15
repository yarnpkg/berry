import {ZipOpenFS, VirtualFS, PosixFS, npath} from '@yarnpkg/fslib';
import {getLibzipSync}                        from '@yarnpkg/libzip';
import * as vscode                            from 'vscode';

export class ZipFSProvider implements vscode.FileSystemProvider {
  private readonly fs = new PosixFS(
    new VirtualFS({
      baseFs: new ZipOpenFS({
        libzip: getLibzipSync(),
        maxOpenFiles: 80,
        useCache: true,
      }),
    })
  );

  stat(uri: vscode.Uri): vscode.FileStat {
    const stat: any = this.fs.statSync(uri.fsPath);

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
    const listing = this.fs.readdirSync(uri.fsPath);
    const results = [];

    for (const entry of listing) {
      const entryStat = this.fs.statSync(npath.join(uri.fsPath, entry));

      if (entryStat.isDirectory()) {
        results.push([entry, vscode.FileType.Directory] as [string, vscode.FileType]);
      } else {
        results.push([entry, vscode.FileType.File] as [string, vscode.FileType]);
      }
    }

    return results;
  }

  readFile(uri: vscode.Uri): Uint8Array {
    return this.fs.readFileSync(uri.fsPath);
  }

  writeFile(uri: vscode.Uri, content: Uint8Array, options: {create: boolean, overwrite: boolean}): void {
    if (!options.create && !this.fs.existsSync(uri.fsPath))
      throw new Error(``);
    if (options.create && !options.overwrite && this.fs.existsSync(uri.fsPath))
      throw new Error(``);

    this.fs.writeFileSync(uri.fsPath, new Buffer(content));
  }

  rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {
    throw new Error(`Not supported`);
  }

  delete(uri: vscode.Uri): void {
    throw new Error(`Not supported`);
  }

  createDirectory(uri: vscode.Uri): void {
    this.fs.mkdirSync(uri.fsPath);
  }

  private _emitter = new vscode.EventEmitter<Array<vscode.FileChangeEvent>>();
  readonly onDidChangeFile = this._emitter.event;

  watch(resource: vscode.Uri, opts: any): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }
}
