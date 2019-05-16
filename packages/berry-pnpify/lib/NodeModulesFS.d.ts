/// <reference types="node" />
import { CreateReadStreamOptions, CreateWriteStreamOptions } from '@berry/fslib';
import { FakeFS, WriteFileOptions } from '@berry/fslib';
import { NativePath, Path } from '@berry/fslib';
import fs from 'fs';
export declare type NodeModulesFSOptions = {
    baseFs?: FakeFS<NativePath>;
};
export declare class NodeModulesFS extends FakeFS<NativePath> {
    private readonly baseFs;
    private readonly pathResolver;
    constructor({ baseFs }?: NodeModulesFSOptions);
    resolve(path: NativePath): NativePath;
    getBaseFs(): FakeFS<NativePath>;
    private resolvePath;
    private resolveFilePath;
    private resolveLink;
    private static makeSymlinkStats;
    private static createFsError;
    private throwIfPathReadonly;
    private resolveDirOrFilePath;
    getRealPath(): NativePath;
    openPromise(p: NativePath, flags: string, mode?: number): Promise<number>;
    openSync(p: NativePath, flags: string, mode?: number): number;
    closePromise(fd: number): Promise<void>;
    closeSync(fd: number): void;
    createReadStream(p: NativePath, opts?: CreateReadStreamOptions): fs.ReadStream;
    createWriteStream(p: NativePath, opts?: CreateWriteStreamOptions): fs.WriteStream;
    realpathPromise(p: NativePath): Promise<NativePath>;
    realpathSync(p: NativePath): NativePath;
    existsPromise(p: NativePath): Promise<boolean>;
    existsSync(p: NativePath): boolean;
    accessPromise(p: NativePath, mode?: number): Promise<void>;
    accessSync(p: NativePath, mode?: number): void;
    statPromise(p: NativePath): Promise<fs.Stats>;
    statSync(p: NativePath): fs.Stats;
    lstatPromise(p: NativePath): Promise<any>;
    lstatSync(p: NativePath): any;
    chmodPromise(p: NativePath, mask: number): Promise<void>;
    chmodSync(p: NativePath, mask: number): void;
    renamePromise(oldP: NativePath, newP: NativePath): Promise<void>;
    renameSync(oldP: NativePath, newP: NativePath): void;
    copyFilePromise(sourceP: NativePath, destP: NativePath, flags?: number): Promise<void>;
    copyFileSync(sourceP: NativePath, destP: NativePath, flags?: number): void;
    writeFilePromise(p: NativePath, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions): Promise<void>;
    writeFileSync(p: NativePath, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions): void;
    unlinkPromise(p: NativePath): Promise<void>;
    unlinkSync(p: NativePath): void;
    utimesPromise(p: NativePath, atime: Date | string | number, mtime: Date | string | number): Promise<void>;
    utimesSync(p: NativePath, atime: Date | string | number, mtime: Date | string | number): void;
    mkdirPromise(p: NativePath): Promise<void>;
    mkdirSync(p: NativePath): void;
    rmdirPromise(p: NativePath): Promise<void>;
    rmdirSync(p: NativePath): void;
    symlinkPromise(target: NativePath, p: NativePath): Promise<void>;
    symlinkSync(target: NativePath, p: string): void;
    readFilePromise(p: NativePath, encoding: 'utf8'): Promise<string>;
    readFilePromise(p: NativePath, encoding?: string): Promise<Buffer>;
    readFileSync(p: NativePath, encoding: 'utf8'): string;
    readFileSync(p: NativePath, encoding?: string): Buffer;
    readdirPromise(p: NativePath): Promise<import("@berry/fslib").Filename[]>;
    readdirSync(p: NativePath): import("@berry/fslib").Filename[];
    readlinkPromise(p: NativePath): Promise<any>;
    readlinkSync(p: NativePath): any;
    removePromise(p: NativePath): Promise<void>;
    removeSync(p: NativePath): void;
    mkdirpPromise(p: NativePath, options?: {
        chmod?: number;
        utimes?: [Date | string | number, Date | string | number];
    }): Promise<void>;
    mkdirpSync(p: NativePath, options?: {
        chmod?: number;
        utimes?: [Date | string | number, Date | string | number];
    }): void;
    copyPromise(destination: NativePath, source: NativePath, options?: {
        baseFs?: undefined;
        overwrite?: boolean;
    }): Promise<void>;
    copyPromise<P2 extends Path>(destination: NativePath, source: P2, options: {
        baseFs: FakeFS<P2>;
        overwrite?: boolean;
    }): Promise<void>;
    copySync(destination: NativePath, source: NativePath, options?: {
        baseFs?: undefined;
        overwrite?: boolean;
    }): void;
    copySync<P2 extends Path>(destination: NativePath, source: P2, options: {
        baseFs: FakeFS<P2>;
        overwrite?: boolean;
    }): void;
}
