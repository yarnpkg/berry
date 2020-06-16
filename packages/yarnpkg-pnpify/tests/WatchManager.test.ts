import {npath, toFilename} from '@yarnpkg/fslib';

import {WatchManager}      from '../sources/WatchManager';

describe(`WatchManager`, () => {
  const manager = new WatchManager();

  it(`should trigger callback when dir entries added`, () => {
    const dirPath = npath.toPortablePath(`/abc`);
    const dirList = new Set([`file1.ts`, `file2.ts`].map(x => toFilename(x)));
    const callback = jest.fn();
    const watcherCallback = jest.fn();

    const watcher = manager.registerWatcher(dirPath, dirList, callback);
    watcher.on(`rename`, watcherCallback);

    manager.notifyWatchers(() => ({
      dirList: new Set([`file1.ts`, `file5.ts`, `file2.ts`, `file3.ts`].map(x => toFilename(x))),
      realPath: dirPath,
      resolvedPath: dirPath,
    }));

    expect(callback).toBeCalledTimes(2);
    expect(callback).toBeCalledWith(`rename`, `file3.ts`);
    expect(callback).toBeCalledWith(`rename`, `file5.ts`);

    expect(watcherCallback).toBeCalledTimes(2);
    expect(watcherCallback).toBeCalledWith(`file3.ts`);
    expect(watcherCallback).toBeCalledWith(`file5.ts`);
  });

  it(`should trigger callback when dir entries removed`, () => {
    const manager = new WatchManager();
    const dirPath = npath.toPortablePath(`/abc`);
    const dirList = new Set([`file1.ts`, `file2.ts`, `file3.ts`, `file4.ts`].map(x => toFilename(x)));
    const callback = jest.fn();
    const watcherCallback = jest.fn();

    const watcher = manager.registerWatcher(dirPath, dirList, callback);
    watcher.on(`rename`, watcherCallback);

    manager.notifyWatchers(() => ({
      dirList: new Set([`file1.ts`, `file4.ts`].map(x => toFilename(x))),
      resolvedPath: dirPath,
      realPath: dirPath,
    }));
    expect(callback).toBeCalledTimes(2);
    expect(callback).toBeCalledWith(`rename`, `file2.ts`);
    expect(callback).toBeCalledWith(`rename`, `file3.ts`);

    expect(watcherCallback).toBeCalledTimes(2);
    expect(watcherCallback).toBeCalledWith(`file2.ts`);
    expect(watcherCallback).toBeCalledWith(`file3.ts`);
  });

  it(`should not trigger closed callback`, () => {
    const dirPath = npath.toPortablePath(`/abc`);
    const dirList = new Set([`file1.ts`].map(x => toFilename(x)));
    const callback = jest.fn();
    const watcherCallback = jest.fn();

    const watcher = manager.registerWatcher(dirPath, dirList, callback);
    watcher.on(`rename`, watcherCallback);
    watcher.close();

    manager.notifyWatchers(() => ({
      dirList: new Set([`file1.ts`, `file2.ts`].map(x => toFilename(x))),
      resolvedPath: dirPath,
      realPath: dirPath,
    }));

    expect(callback).toBeCalledTimes(0);
    expect(watcherCallback).toBeCalledTimes(0);
  });
});
