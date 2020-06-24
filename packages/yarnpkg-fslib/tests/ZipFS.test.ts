import {getLibzipSync}                   from '@yarnpkg/libzip';
import {Stats}                           from 'fs';

import {PortablePath, ppath, toFilename} from '../sources/path';
import {xfs, ZipFS}                      from '../sources';

describe(`ZipFS`, () => {
  it(`should handle symlink correctly`, () => {
    const expectSameStats = (a: Stats, b: Stats) => {
      expect(a.ino).toEqual(b.ino);
      expect(a.size).toEqual(b.size);
      expect(a.mode).toEqual(b.mode);
      expect(a.atimeMs).toEqual(b.atimeMs);
      expect(a.mtimeMs).toEqual(b.mtimeMs);
      expect(a.ctimeMs).toEqual(b.ctimeMs);
      expect(a.birthtimeMs).toEqual(b.birthtimeMs);
      expect(a.isFile()).toEqual(a.isFile());
      expect(a.isDirectory()).toEqual(a.isDirectory());
      expect(a.isSymbolicLink()).toEqual(a.isSymbolicLink());
    };

    const asserts = (zipFs: ZipFS) => {
      const dir = zipFs.statSync(`/dir` as PortablePath);
      expect(dir.isFile()).toBeFalsy();
      expect(dir.isDirectory()).toBeTruthy();
      expect(dir.isSymbolicLink()).toBeFalsy();

      const file = zipFs.statSync(`/dir/file` as PortablePath);
      expect(file.isFile()).toBeTruthy();
      expect(file.isDirectory()).toBeFalsy();
      expect(file.isSymbolicLink()).toBeFalsy();

      expectSameStats(zipFs.lstatSync(`/dir/file` as PortablePath), file);
      expectSameStats(zipFs.lstatSync(`/dir` as PortablePath), dir);

      expectSameStats(zipFs.statSync(`/linkToFileA` as PortablePath), file);
      expectSameStats(zipFs.statSync(`/linkToFileB` as PortablePath), file);
      expectSameStats(zipFs.statSync(`/linkToDirA/file` as PortablePath), file);
      expectSameStats(zipFs.statSync(`/linkToDirB/file` as PortablePath), file);
      expectSameStats(zipFs.statSync(`/linkToCwd/linkToCwd/linkToCwd/linkToCwd/dir/file` as PortablePath), file);

      expectSameStats(zipFs.statSync(`/linkToDirA` as PortablePath), dir);
      expectSameStats(zipFs.statSync(`/linkToDirB` as PortablePath), dir);
      expectSameStats(zipFs.statSync(`/linkToCwd/linkToCwd/linkToCwd/linkToCwd/linkToDirA` as PortablePath), dir);

      expectSameStats(zipFs.lstatSync(`/linkToDirA/file` as PortablePath), file);
      expectSameStats(zipFs.lstatSync(`/linkToDirB/file` as PortablePath), file);
      expectSameStats(zipFs.lstatSync(`/linkToCwd/linkToCwd/linkToCwd/linkToCwd/dir/file` as PortablePath), file);

      const linkToDirA = zipFs.lstatSync(`/linkToDirA` as PortablePath);
      expect(linkToDirA.isFile()).toBeFalsy();
      expect(linkToDirA.isDirectory()).toBeFalsy();
      expect(linkToDirA.isSymbolicLink()).toBeTruthy();

      const linkToDirB = zipFs.lstatSync(`/linkToDirB` as PortablePath);
      expect(linkToDirB.isFile()).toBeFalsy();
      expect(linkToDirB.isDirectory()).toBeFalsy();
      expect(linkToDirB.isSymbolicLink()).toBeTruthy();

      for (const path of [
        `/linkToFileA`,
        `/linkToFileB`,
        `/linkToDirA/file`,
        `/linkToDirB/file`,
        `/dir/file`,
        `/linkToCwd/linkToCwd/linkToCwd/linkToCwd/dir/file`,
      ])
        expect(zipFs.readFileSync(path as PortablePath, `utf8`)).toEqual(`file content`);


      for (const path of [
        `/linkToDirA`,
        `/linkToDirB`,
        `/linkToCwd/linkToCwd/linkToCwd/linkToCwd/dir`,
        `/linkToCwd/linkToCwd/linkToCwd/linkToCwd/linkToDirA`,
        `/linkToCwd/linkToCwd/linkToCwd/linkToCwd/linkToDirB`,
      ]) {
        expect(zipFs.readdirSync(path as PortablePath)).toContain(`file`);
      }
    };

    const libzip = getLibzipSync();
    const tmpfile = ppath.resolve(xfs.mktempSync(), toFilename(`test.zip`));
    const zipFs = new ZipFS(tmpfile, {libzip, create: true});

    zipFs.mkdirPromise(`/dir` as PortablePath);
    zipFs.writeFileSync(`/dir/file` as PortablePath, `file content`);

    zipFs.symlinkSync(`dir/file` as PortablePath, `linkToFileA` as PortablePath);
    zipFs.symlinkSync(`./dir/file` as PortablePath, `linkToFileB` as PortablePath);
    zipFs.symlinkSync(`dir` as PortablePath, `linkToDirA` as PortablePath);
    zipFs.symlinkSync(`./dir` as PortablePath, `linkToDirB` as PortablePath);
    zipFs.symlinkSync(`.` as PortablePath, `linkToCwd` as PortablePath);

    // asserts(zipFs);
    zipFs.saveAndClose();

    const zipFs2 = new ZipFS(tmpfile, {libzip});
    asserts(zipFs2);
    zipFs2.discardAndClose();
  });

  it(`should readSync file contents`, async () => {
    const readFileContents = function (zipFs: ZipFS, p: PortablePath, position: number | null) {
      const fd = zipFs.openSync(p, `r`);
      const buffer = Buffer.alloc(8192);
      try {
        let size = 0;
        let read = 0;
        while ((read = zipFs.readSync(fd, buffer, 0, buffer.length, position)) !== 0)
          size += read;

        return buffer.toString(`utf-8`, 0, size);
      } finally {
        zipFs.closeSync(fd);
      }
    };
    const readSyncAsserts = (zipFs: ZipFS) => {
      const p = `/dir/file` as PortablePath;
      expect(readFileContents(zipFs, p, -1)).toEqual(`file content`);
      expect(readFileContents(zipFs, p, null)).toEqual(`file content`);
    };

    const libzip = getLibzipSync();
    const tmpfile = ppath.resolve(xfs.mktempSync(), toFilename(`test2.zip`));
    const zipFs = new ZipFS(tmpfile, {libzip, create: true});
    await zipFs.mkdirPromise(`/dir` as PortablePath);
    zipFs.writeFileSync(`/dir/file` as PortablePath, `file content`);
    zipFs.saveAndClose();

    const zipFs2 = new ZipFS(tmpfile, {libzip});
    readSyncAsserts(zipFs2);
    zipFs2.discardAndClose();
  });

  it(`can create a zip file in memory`, () => {
    const libzip = getLibzipSync();
    const zipFs = new ZipFS(null, {libzip});

    zipFs.writeFileSync(`/foo.txt`as PortablePath, `Test`);

    const zipContent = zipFs.getBufferAndClose();

    const zipFs2 = new ZipFS(zipContent, {libzip});
    expect(zipFs2.readFileSync(`/foo.txt` as PortablePath, `utf8`)).toEqual(`Test`);
  });

  it(`can handle nested symlinks`, () => {
    const libzip = getLibzipSync();
    const zipFs = new ZipFS(null, {libzip});
    zipFs.writeFileSync(`/foo.txt`as PortablePath, `Test`);

    zipFs.symlinkSync(`/foo.txt` as PortablePath, `/linkA` as PortablePath);
    zipFs.symlinkSync(`/linkA` as PortablePath, `/linkB` as PortablePath);

    const zipFs2 = new ZipFS(zipFs.getBufferAndClose(), {libzip});

    expect(zipFs2.readFileSync(`/linkA` as PortablePath, `utf8`)).toEqual(`Test`);
    expect(zipFs2.readFileSync(`/linkB` as PortablePath, `utf8`)).toEqual(`Test`);

    zipFs2.discardAndClose();
  });
});

