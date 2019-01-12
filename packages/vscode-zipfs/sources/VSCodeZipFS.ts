import {ZipFS}     from '@berry/zipfs';
import {posix}     from 'path';
import * as vscode from 'vscode';

export class VSCodeZipFS {
}

/*
export class VSCodeZipFS implements vscode.FileSystemProvider {
    private readonly zipFs: ZipFS;

    constructor(zipFs: ZipFS) {
        this.zipFs = zipFs;
    }

    stat(uri: vscode.Uri): vscode.FileStat {
        return this.zipFs.statSync(uri.path);
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
        return this.zipFs.readFile(uri.path);
    }

    writeFile(uri: vscode.Uri, content: Uint8Array, options: {create: boolean, overwrite: boolean}): void {
        throw new Error(`Not supported`);
    }

    rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {
        throw new Error(`Not supported`);
    }

    delete(uri: vscode.Uri): void {
        throw new Error(`Not supported`);
    }

    createDirectory(uri: vscode.Uri): void {
        throw new Error(`Not supported`);
    }

    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile = this._emitter.event;

    watch(resource: vscode.Uri, opts): vscode.Disposable {
        return new vscode.Disposable(() => {});
    }
}
*/