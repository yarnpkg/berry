import * as constants from './constants';
import * as errors    from './errors';
import * as statUtils from './statUtils';

export {constants};
export {errors};
export {statUtils};

export type {LinkStrategy}                       from './algorithms/copyPromise';
export {setupCopyIndex}                          from './algorithms/copyPromise';
export {opendir, CustomDir}                      from './algorithms/opendir';
export {watchFile, unwatchFile, unwatchAllFiles} from './algorithms/watchFile';

export {normalizeLineEndings}                        from './FakeFS';
export type {BufferEncodingOrBuffer}                 from './FakeFS';
export type {CreateReadStreamOptions}                from './FakeFS';
export type {CreateWriteStreamOptions}               from './FakeFS';
export type {Dirent, DirentNoPath, Dir, SymlinkType} from './FakeFS';
export type {MkdirOptions}                           from './FakeFS';
export type {ReaddirOptions}                         from './FakeFS';
export type {RmdirOptions, RmOptions}                from './FakeFS';
export type {WatchOptions}                           from './FakeFS';
export type {WatchCallback}                          from './FakeFS';
export type {Watcher}                                from './FakeFS';
export type {WriteFileOptions}                       from './FakeFS';
export type {ExtractHintOptions}                     from './FakeFS';
export type {WatchFileOptions}                       from './FakeFS';
export type {WatchFileCallback}                      from './FakeFS';
export type {StatWatcher}                            from './FakeFS';
export type {OpendirOptions}                         from './FakeFS';
export type {StatOptions, StatSyncOptions}           from './FakeFS';
export type {Stats, BigIntStats}                     from './FakeFS';

export {PortablePath, Filename}                            from './path';
export type {FSPath, Path, NativePath}                     from './path';
export type {ParsedPath, PathUtils, FormatInputPathObject} from './path';
export {npath, ppath}                          from './path';

export {AliasFS}                                           from './AliasFS';
export {FakeFS, BasePortableFakeFS}                        from './FakeFS';
export {CwdFS}                                             from './CwdFS';
export {JailFS}                                            from './JailFS';
export {LazyFS}                                            from './LazyFS';
export {MountFS}                                           from './MountFS';
export type {GetMountPointFn, MountableFS, MountFSOptions} from './MountFS';
export {NoFS}                                              from './NoFS';
export {NodeFS}                                            from './NodeFS';
export {PosixFS}                                           from './PosixFS';
export {ProxiedFS}                                         from './ProxiedFS';
export {VirtualFS}                                         from './VirtualFS';

export {patchFs, extendFs} from './patchFs/patchFs';

export {xfs} from './xfs';
export type {XFS} from './xfs';
