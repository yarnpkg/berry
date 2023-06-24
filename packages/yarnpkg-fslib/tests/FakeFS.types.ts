import {Dirent, DirentNoPath, FakeFS, Filename, PortablePath} from '../sources';

declare const fakeFs: FakeFS<PortablePath>;

type AssertEqual<T, Expected> = [T, Expected] extends [Expected, T] ? true : false;

function assertEqual<U>() {
  return <V>(val: V, expected: AssertEqual<U, V>) => {};
}

Promise.resolve().then(async () => {
  assertEqual<Array<Filename>>()(await fakeFs.readdirPromise(PortablePath.dot), true);
  assertEqual<Array<Filename>>()(await fakeFs.readdirPromise(PortablePath.dot, {}), true);

  assertEqual<Array<Filename | PortablePath>>()(await fakeFs.readdirPromise(PortablePath.dot, {recursive: Boolean()}), true);

  assertEqual<Array<PortablePath>>()(await fakeFs.readdirPromise(PortablePath.dot, {recursive: true}), true);
  assertEqual<Array<Dirent<PortablePath>>>()(await fakeFs.readdirPromise(PortablePath.dot, {recursive: true, withFileTypes: true}), true);

  assertEqual<Array<Filename>>()(await fakeFs.readdirPromise(PortablePath.dot, {recursive: false}), true);
  assertEqual<Array<DirentNoPath>>()(await fakeFs.readdirPromise(PortablePath.dot, {recursive: false, withFileTypes: true}), true);
});
