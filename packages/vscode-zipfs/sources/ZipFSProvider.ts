import {VirtualFS, PosixFS, npath} from '@yarnpkg/fslib';
import {ZipOpenFS}                 from '@yarnpkg/libzip';
import * as vscode                 from 'vscode';

/**
 * The file extensions that will be interpreted as zip archives unless the user overrides them
 * through the `zipfs.fileExtensions` setting. Must be kept in sync with the `languages`,
 * `activationEvents` and `menus` contributions in `./package.json`, which cannot reference this
 * constant (VS Code resolves those statically, so a custom extension only takes effect after a
 * reload and only activates the extension when the workspace already contains a matching archive).
 */
const DEFAULT_ZIP_ARCHIVE_EXTENSIONS = [`.zip`, `.jar`, `.war`, `.apk`, `.ipa`, `.crx`];

function readArchiveExtensions(): Array<string> {
  const configured = vscode.workspace
    .getConfiguration(`zipfs`)
    .get<Array<string>>(`fileExtensions`);

  if (!Array.isArray(configured))
    return DEFAULT_ZIP_ARCHIVE_EXTENSIONS;

  const extensions = configured.filter(
    extension => typeof extension === `string` && extension.length > 0,
  );

  return extensions.length > 0
    ? extensions
    : DEFAULT_ZIP_ARCHIVE_EXTENSIONS;
}

export class ZipFSProvider implements vscode.FileSystemProvider {
  private readonly archiveExtensions = readArchiveExtensions();

  private readonly fs = new PosixFS(
    new VirtualFS({
      baseFs: new ZipOpenFS({
        useCache: true,
        maxOpenFiles: 80,
        fileExtensions: this.archiveExtensions,
      }),
    }),
  );

  stat(uri: vscode.Uri): vscode.FileStat {
    const stat: any = this.fs.statSync(uri.fsPath);

    switch (true) {
      case stat.isDirectory():
      case this.archiveExtensions.includes(npath.extname(uri.fsPath)): {
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
    const listing = this.fs.readdirSync(uri.fsPath);

    return listing.map(entry => {
      const {type} = this.stat(vscode.Uri.joinPath(uri, entry));
      return [entry, type];
    });
  }

  readFile(uri: vscode.Uri): Uint8Array {
    return this.fs.readFileSync(uri.fsPath);
  }

  writeFile(uri: vscode.Uri, content: Uint8Array, options: {create: boolean, overwrite: boolean}): void {
    if (!options.create && !this.fs.existsSync(uri.fsPath))
      throw vscode.FileSystemError.FileNotFound(uri);
    if (options.create && !options.overwrite && this.fs.existsSync(uri.fsPath))
      throw vscode.FileSystemError.FileExists(uri);

    this.fs.writeFileSync(uri.fsPath, Buffer.from(content));
  }

  rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: {overwrite: boolean}): void {
    throw new Error(`Not supported`);
  }

  delete(uri: vscode.Uri, options: {recursive: boolean}): void {
    this.fs.removeSync(uri.fsPath, options);
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
