import {ZipOpenFS} from '@berry/zipfs';
import {posix}     from 'path';
import * as vscode from 'vscode';

export class ZipFSProvider implements vscode.FileSystemProvider {
    private readonly zipFs = new ZipOpenFS({useCache: false});

    stat(uri: vscode.Uri): vscode.FileStat {
        const stat: any = this.zipFs.statSync(uri.path);

        if (stat.isDirectory())
            stat.type = vscode.FileType.Directory;
        else if (stat.isFile())
            stat.type = vscode.FileType.File;
        else
            stat.type = vscode.FileType.Unknown;

        return stat;
    }

    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
        const listing = this.zipFs.readdirSync(uri.path);
        const results = [];

        for (const entry of listing) {
            const entryStat = this.zipFs.statSync(posix.join(uri.path, entry));

            if (entryStat.isDirectory()) {
                results.push([entry, vscode.FileType.Directory] as [string, vscode.FileType]);
            } else {
                results.push([entry, vscode.FileType.File] as [string, vscode.FileType])
            }
        }

        return results;
    }

    readFile(uri: vscode.Uri): Uint8Array {
        return this.zipFs.readFileSync(uri.path) as any as Buffer;
    }

    writeFile(uri: vscode.Uri, content: Uint8Array, options: {create: boolean, overwrite: boolean}): void {
        if (!options.create && !this.zipFs.existsSync(uri.path))
            throw new Error(``);
        if (options.create && !options.overwrite && this.zipFs.existsSync(uri.path))
            throw new Error(``);
        
        this.zipFs.writeFileSync(uri.path, new Buffer(content));
    }

    rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {
        throw new Error(`Not supported`);
    }

    delete(uri: vscode.Uri): void {
        throw new Error(`Not supported`);
    }

    createDirectory(uri: vscode.Uri): void {
        this.zipFs.mkdirSync(uri.path);
    }

    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile = this._emitter.event;

    watch(resource: vscode.Uri, opts: any): vscode.Disposable {
        return new vscode.Disposable(() => {});
    }
}
