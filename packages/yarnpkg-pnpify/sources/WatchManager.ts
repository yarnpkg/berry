import {Filename, PortablePath, Watcher, WatchCallback} from '@yarnpkg/fslib';

import {EventEmitter}                                   from 'events';

import {ResolvedPath}                                   from './resolveNodeModulesPath';

class WatchEventEmitter extends EventEmitter {
  private dirWatchers: DirectoryWatcherMap;
  private watchPath: PortablePath;
  private watcherId: number;

  public constructor(dirWatchers: DirectoryWatcherMap, watchPath: PortablePath, watcherId: number) {
    super();
    this.dirWatchers = dirWatchers;
    this.watchPath = watchPath;
    this.watcherId = watcherId;
  }

  public close() {
    const dirWatcher = this.dirWatchers.get(this.watchPath)!;
    dirWatcher.eventEmitters.delete(this.watcherId);
    if (dirWatcher.eventEmitters.size === 0) {
      this.dirWatchers.delete(this.watchPath);
    }
  }
}

type DirectoryWatcherMap = Map<PortablePath, DirectoryWatcher>;

interface DirectoryWatcher {
  eventEmitters: Map<number, Watcher & EventEmitter>;
  dirEntries: Set<Filename>;
}

export class WatchManager extends EventEmitter {
  private readonly dirWatchers: DirectoryWatcherMap = new Map();
  private lastWatcherId: number = 0;

  public registerWatcher(watchPath: PortablePath, dirList: Set<Filename>, callback: WatchCallback): WatchEventEmitter {
    let dirWatcher = this.dirWatchers.get(watchPath);
    if (!dirWatcher) {
      dirWatcher = {eventEmitters: new Map(), dirEntries: dirList};
      this.dirWatchers.set(watchPath, dirWatcher);
    }
    const watcherId = this.lastWatcherId++;

    const watchEventEmitter = new WatchEventEmitter(this.dirWatchers, watchPath, watcherId);
    dirWatcher.eventEmitters.set(watcherId, watchEventEmitter);

    watchEventEmitter.on(`rename`, (filename: string) => callback(`rename`, filename));

    return watchEventEmitter;
  }

  public notifyWatchers(resolvePath: (nodePath: PortablePath) => ResolvedPath) {
    for (const [watchPath, dirWatcher] of this.dirWatchers) {
      const newDirEntries = resolvePath(watchPath).dirList || new Set();
      // Difference between new and old directory contents
      const dirEntryDiff = new Set();
      for (const entry of newDirEntries) {
        if (!dirWatcher.dirEntries.has(entry)) {
          dirEntryDiff.add(entry);
        }
      }
      for (const entry of dirWatcher.dirEntries) {
        if (!newDirEntries.has(entry)) {
          dirEntryDiff.add(entry);
        }
      }

      for (const entry of dirEntryDiff) {
        for (const watchEventEmitter of dirWatcher.eventEmitters.values()) {
          watchEventEmitter.emit(`rename`, entry);
        }
      }
      dirWatcher.dirEntries = newDirEntries;
    }
  }
}
