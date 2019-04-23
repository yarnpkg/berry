/**
 * Virtual dirs emulator for the dirs that end with `node_modules` and `node_modules/@some_scope`.
 *
 * These dirs are special for emulation of `node_modules` dependencies on the filesystem,
 * because they do not exist. And we need to emulate all the fs calls and events for these dirs.
 */
export class ContainerDirsEmulator {
  private cache: { [dirName: string]: string[] } = {};

  public readDir(containerDir: string) {
    if (!this.cache[containerDir]) {

    }

    return this.cache[containerDir];
  }
}