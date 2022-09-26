import {ZipFS, ZipOpenFS}              from '@yarnpkg/libzip';
import fs                              from 'fs';
import {pathToFileURL}                 from 'url';
import {promisify}                     from 'util';

import {ZIP_FILE1, ZIP_DIR1}           from '../../yarnpkg-libzip/tests/ZipOpenFS.test';
import {NodeFS}                        from '../sources/NodeFS';
import {PosixFS}                       from '../sources/PosixFS';
import {extendFs}                      from '../sources/patchFs/patchFs';
import {Filename, npath, PortablePath} from '../sources/path';
import {xfs}                           from '../sources/xfs';
import {statUtils}                     from '../sources';

const ifNotWin32It = process.platform !== `win32` ? it : it.skip;

describe(`patchedFs`, () => {
  it(`in case of no error, give null: fs.stat`, done => {
    const file = npath.join(__dirname, `patchedFs.test.ts` as Filename);

    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    patchedFs.stat(file, err => {
      expect(err).toEqual(null);
      done();
    });
  });

  it(`in case of no error, give null: fs.read`, done => {
    const file = npath.join(__dirname, `patchedFs.test.ts` as Filename);

    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    const id = patchedFs.openSync(file, `r`);

    patchedFs.read(id, Buffer.alloc(1), 0, 1, 0, err => {
      patchedFs.closeSync(id);
      expect(err).toEqual(null);
      done();
    });
  });

  it(`in case of the parameter of fs.exists is not a string, give false`, done => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    patchedFs.exists(undefined as any, exists => {
      expect(exists).toBe(false);
      done();
    });
  });

  it(`matches the util.promisify return shape of node: fs.read`, async () => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));
    const patchedFsReadAsync = promisify(patchedFs.read);

    const file = npath.join(__dirname, `patchedFs.test.ts` as Filename);

    const fd = fs.openSync(file, `r`);

    const bufferFs = Buffer.alloc(16);

    const result = await patchedFsReadAsync(fd, bufferFs, 0, 16, 0);

    expect(typeof result.bytesRead).toBe(`number`);
    expect(Buffer.isBuffer(result.buffer)).toBeTruthy();
  });

  it(`matches the util.promisify return shape of node: fs.write`, async () => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));
    const patchedFsWriteAsync = promisify(patchedFs.write);

    const tmpdir = npath.fromPortablePath(xfs.mktempSync());

    const file = npath.join(tmpdir, `file.txt`);

    const fd = fs.openSync(file, `w`);

    const bufferFs = Buffer.alloc(16);

    const result = await patchedFsWriteAsync(fd, bufferFs, 0, 16, 0);

    expect(typeof result.bytesWritten).toBe(`number`);
    expect(Buffer.isBuffer(result.buffer)).toBeTruthy();
  });

  it(`should support URL instances`, () => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    const tmpdir = npath.fromPortablePath(xfs.mktempSync());
    const tmpdirUrl = pathToFileURL(tmpdir);

    const file = `${tmpdir}/file.txt`;
    const fileUrl = pathToFileURL(file);

    patchedFs.writeFileSync(fileUrl, `Hello World`);

    expect(patchedFs.readdirSync(tmpdirUrl)).toStrictEqual(patchedFs.readdirSync(tmpdir));

    expect(patchedFs.readFileSync(fileUrl, {encoding: `utf8`})).toStrictEqual(patchedFs.readFileSync(file, {encoding: `utf8`}));
    expect(patchedFs.statSync(fileUrl)).toStrictEqual(patchedFs.statSync(file));

    const copyUrl = pathToFileURL(`${tmpdir}/copy.txt`);
    const renamedUrl = pathToFileURL(`${tmpdir}/renamed.txt`);

    patchedFs.copyFileSync(fileUrl, copyUrl);
    patchedFs.renameSync(copyUrl, renamedUrl);
    patchedFs.unlinkSync(renamedUrl);

    expect(patchedFs.existsSync(renamedUrl)).toStrictEqual(false);
  });

  it(`should support fstat`, async () => {
    const patchedFs = extendFs(fs, new PosixFS(new ZipOpenFS({baseFs: new NodeFS()})));

    const fd = patchedFs.openSync(__filename, `r`);
    try {
      const stat = patchedFs.statSync(__filename);
      const fdStat = patchedFs.fstatSync(fd);

      expect(statUtils.areStatsEqual(stat, fdStat)).toEqual(true);
    } finally {
      patchedFs.closeSync(fd);
    }

    const zipFd = patchedFs.openSync(ZIP_FILE1, `r`);
    try {
      const stat = await new Promise<fs.Stats>((resolve, reject) => {
        patchedFs.stat(ZIP_FILE1, (err, stats) => {
          err ? reject(err) : resolve(stats);
        });
      });

      const fdStat = await new Promise<fs.Stats>((resolve, reject) => {
        patchedFs.fstat(zipFd, (err, stats) => {
          err ? reject(err) : resolve(stats);
        });
      });

      expect(statUtils.areStatsEqual(stat, fdStat)).toEqual(true);
    } finally {
      patchedFs.closeSync(fd);
    }
  });

  it(`should support passing null as the second argument to readdir`, async () => {
    const patchedFs = extendFs(fs, new PosixFS(new ZipOpenFS({baseFs: new NodeFS()})));

    const tmpdir = npath.fromPortablePath(xfs.mktempSync());

    expect(patchedFs.readdirSync(tmpdir, null)).toHaveLength(0);
    await expect(new Promise((resolve, reject) =>
      patchedFs.readdir(tmpdir, null, (err, files) =>
        err ? reject(err) : resolve(files),
      ),
    )).resolves.toHaveLength(0);
    await expect(patchedFs.promises.readdir(tmpdir, null)).resolves.toHaveLength(0);

    expect(patchedFs.readdirSync(ZIP_DIR1, null)).toStrictEqual([`foo.txt`]);
    await expect(new Promise((resolve, reject) =>
      patchedFs.readdir(ZIP_DIR1, null, (err, files) =>
        err ? reject(err) : resolve(files),
      ),
    )).resolves.toStrictEqual([`foo.txt`]);
    await expect(patchedFs.promises.readdir(ZIP_DIR1, null)).resolves.toStrictEqual([`foo.txt`]);
  });

  it(`should support createReadStream`, async () => {
    const tmpdir = xfs.mktempSync();
    const nativeTmpdir = npath.fromPortablePath(tmpdir);

    const zipFs = new ZipFS(`${tmpdir}/archive.zip` as PortablePath, {create: true});
    await zipFs.writeFilePromise(`/a.txt` as PortablePath, `foo`);

    zipFs.saveAndClose();

    const patchedFs = extendFs(fs, new PosixFS(new ZipOpenFS({baseFs: new NodeFS()})));

    const readStream = patchedFs.createReadStream(`${nativeTmpdir}/archive.zip/a.txt`);

    await expect(new Promise((resolve, reject) => {
      const chunks: Array<Buffer> = [];

      readStream.on(`data`, chunk => {
        chunks.push(chunk as Buffer);
      });

      readStream.on(`close`, () => {
        resolve(Buffer.concat(chunks).toString());
      });
      readStream.on(`error`, err => {
        reject(err);
      });
    })).resolves.toStrictEqual(`foo`);
  });

  it(`should support createWriteStream`, async () => {
    const tmpdir = xfs.mktempSync();
    const nativeTmpdir = npath.fromPortablePath(tmpdir);

    const zipFs = new ZipFS(`${tmpdir}/archive.zip` as PortablePath, {create: true});
    await zipFs.writeFilePromise(`/a.txt` as PortablePath, ``);

    zipFs.saveAndClose();

    const patchedFs = extendFs(fs, new PosixFS(new ZipOpenFS({baseFs: new NodeFS()})));

    const writeStream = patchedFs.createWriteStream(`${nativeTmpdir}/archive.zip/a.txt`);

    await new Promise<void>((resolve, reject) => {
      writeStream.write(`foo`, err => {
        if (err) {
          reject(err);
        } else {
          writeStream.destroy();
          resolve();
        }
      });
    });

    expect(patchedFs.readFileSync(`${nativeTmpdir}/archive.zip/a.txt`, `utf8`)).toStrictEqual(`foo`);
  });

  it(`should support readSync using options`, () => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    const fd = patchedFs.openSync(__filename, `r`);

    const buffer = Buffer.alloc(128);
    try {
      const bytesRead = patchedFs.readSync(fd, buffer);

      expect(bytesRead).toEqual(buffer.byteLength);
    } finally {
      patchedFs.closeSync(fd);
    }
  });

  it(`should support read using options`, async() => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    const fd = patchedFs.openSync(__filename, `r`);

    const buffer = Buffer.alloc(42);
    try {
      const bytesRead = await new Promise<number>((resolve, reject) => {
        patchedFs.read(fd, {buffer}, (err, bytesRead, buffer) => {
          if (err) {
            reject(err);
          } else {
            resolve(bytesRead);
          }
        });
      });

      expect(bytesRead).toEqual(buffer.byteLength);
    } finally {
      patchedFs.closeSync(fd);
    }
  });

  ifNotWin32It(`should support fchmodSync`, async () => {
    await xfs.mktempPromise(async dir => {
      const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));
      const p = npath.join(npath.fromPortablePath(dir), `foo.txt`);

      const fd = patchedFs.openSync(p, `w`);
      patchedFs.fchmodSync(fd, 0o744);
      patchedFs.closeSync(fd);

      expect((patchedFs.statSync(p)).mode & 0o777).toBe(0o744);
    });
  });

  ifNotWin32It(`should support fchmod`, async () => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    await xfs.mktempPromise(async dir => {
      const p = npath.join(npath.fromPortablePath(dir), `foo.txt`);

      const fd = patchedFs.openSync(p, `w`);

      await new Promise<void>((resolve, reject) => {
        patchedFs.fchmod(fd, 0o744, err => {
          err ? reject(err) : resolve();
        });
      });

      patchedFs.closeSync(fd);

      expect((patchedFs.statSync(p)).mode & 0o777).toBe(0o744);
    });
  });

  it(`should support FileHandle.stat`, async () => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    const fd = await patchedFs.promises.open(__filename, `r`);
    const fdStats = await fd.stat();
    await fd.close();

    const syncStats = patchedFs.statSync(__filename);

    expect(statUtils.areStatsEqual(fdStats, syncStats)).toEqual(true);
  });

  it(`should support FileHandle.read`, async () => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    await xfs.mktempPromise(async dir => {
      const filepath = npath.join(npath.fromPortablePath(dir), `foo.txt`);
      await patchedFs.promises.writeFile(filepath, `foo`);

      {
        const fd = await patchedFs.promises.open(filepath, `r`);

        const data = Buffer.allocUnsafe(3);
        await expect(fd.read(data, 0, 3)).resolves.toMatchObject({
          buffer: data,
          bytesRead: 3,
        });

        await fd.close();
      }

      {
        const fd = await patchedFs.promises.open(filepath, `r`);

        const {buffer, bytesRead} = await fd.read();
        expect(bytesRead).toEqual(3);
        expect(buffer.subarray(0, 3)).toEqual(Buffer.from(`foo`));

        await fd.close();
      }
    });
  });

  it(`should support FileHandle.readFile`, async () => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    await xfs.mktempPromise(async dir => {
      const filepath = npath.join(npath.fromPortablePath(dir), `foo.txt`);
      await patchedFs.promises.writeFile(filepath, `foo`);

      {
        const fd = await patchedFs.promises.open(filepath, `r`);
        await expect(fd.readFile()).resolves.toEqual(Buffer.from(`foo`));
        await fd.close();
      }

      {
        const fd = await patchedFs.promises.open(filepath, `r`);
        await expect(fd.readFile({})).resolves.toEqual(Buffer.from(`foo`));
        await fd.close();
      }

      {
        const fd = await patchedFs.promises.open(filepath, `r`);
        await expect(fd.readFile(`utf8`)).resolves.toEqual(`foo`);
        await fd.close();
      }

      {
        const fd = await patchedFs.promises.open(filepath, `r`);
        await expect(fd.readFile({encoding: `utf8`})).resolves.toEqual(`foo`);
        await fd.close();
      }
    });
  });

  it(`should support FileHandle.write`, async () => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    await xfs.mktempPromise(async dir => {
      const filepath = npath.join(npath.fromPortablePath(dir), `foo.txt`);
      const fd = await patchedFs.promises.open(filepath, `w`);

      await expect(fd.write(`foo`)).resolves.toMatchObject({
        buffer: `foo`,
        bytesWritten: 3,
      });

      const data = Buffer.from(`bar`);
      await expect(fd.write(data)).resolves.toMatchObject({
        buffer: data,
        bytesWritten: 3,
      });

      await fd.close();

      await expect(patchedFs.promises.readFile(filepath, `utf8`)).resolves.toEqual(`foobar`);
    });
  });

  it(`should support FileHandle.writev`, async () => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    await xfs.mktempPromise(async dir => {
      const filepath = npath.join(npath.fromPortablePath(dir), `foo.txt`);
      const fd = await patchedFs.promises.open(filepath, `w`);

      await expect(fd.writev([Buffer.from(`foo`), Buffer.from(`bar`)])).resolves.toMatchObject({
        bytesWritten: 6,
      });

      await expect(patchedFs.promises.readFile(filepath, `utf8`)).resolves.toEqual(`foobar`);

      await expect(fd.writev([Buffer.from(`foo`), Buffer.from(`bar`)], 1)).resolves.toMatchObject({
        bytesWritten: 6,
      });

      await expect(patchedFs.promises.readFile(filepath, `utf8`)).resolves.toEqual(`ffoobar`);

      await fd.close();
    });
  });

  it(`should support FileHandle.writeFile`, async () => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    await xfs.mktempPromise(async dir => {
      const filepath = npath.join(npath.fromPortablePath(dir), `foo.txt`);

      const fd = await patchedFs.promises.open(filepath, `w`);
      await fd.writeFile(`foo`);
      await fd.writeFile(`bar`);
      await fd.close();

      await expect(patchedFs.promises.readFile(filepath, `utf8`)).resolves.toEqual(`foobar`);
    });
  });

  it(`should support FileHandle.appendFile`, async () => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    await xfs.mktempPromise(async dir => {
      const filepath = npath.join(npath.fromPortablePath(dir), `foo.txt`);
      await patchedFs.promises.writeFile(filepath, `foo`);

      const fd = await patchedFs.promises.open(filepath, `r+`);

      // Move to the end of the file
      await fd.readFile();

      await expect(fd.appendFile(`bar`)).resolves.toBeUndefined();

      await fd.close();

      await expect(patchedFs.promises.readFile(filepath, `utf8`)).resolves.toEqual(`foobar`);
    });
  });

  it(`should support ref counting in FileHandle`, async () => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    await xfs.mktempPromise(async dir => {
      const filepath = npath.join(npath.fromPortablePath(dir), `foo.txt`);
      await patchedFs.promises.writeFile(filepath, `foo`);

      const fd = await patchedFs.promises.open(filepath, `r+`);

      await expect(Promise.all([
        fd.stat(),
        fd.close(),
        fd.stat(),
      ])).resolves.toBeTruthy();

      expect(fd.fd).toEqual(-1);
    });
  });

  it(`should throw when when using a closed FileHandle`, async () => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    await xfs.mktempPromise(async dir => {
      const filepath = npath.join(npath.fromPortablePath(dir), `foo.txt`);
      await patchedFs.promises.writeFile(filepath, `foo`);

      const fd = await patchedFs.promises.open(filepath, `r+`);
      await fd.close();

      await expect(fd.stat()).rejects.toMatchObject({
        message: `file closed`,
        code: `EBADF`,
        syscall: `stat`,
      });
    });
  });

  it(`should support passing a FileHandle to fs.promises functions`, async () => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    await xfs.mktempPromise(async dir => {
      const filepath = npath.join(npath.fromPortablePath(dir), `foo.txt`);
      await patchedFs.promises.writeFile(filepath, `foo`);

      const fd = await patchedFs.promises.open(filepath, `r+`);

      await expect(patchedFs.promises.readFile(fd, `utf8`)).resolves.toEqual(`foo`);

      await fd.close();
    });
  });

  it(`should support FileHandle.truncate`, async () => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    await xfs.mktempPromise(async dir => {
      const filepath = npath.join(npath.fromPortablePath(dir), `foo.txt`);
      await patchedFs.promises.writeFile(filepath, `foo`);

      const fd = await patchedFs.promises.open(filepath, `r+`);
      await fd.truncate(1);
      await fd.close();

      await expect(patchedFs.promises.readFile(filepath, `utf8`)).resolves.toEqual(`f`);
    });
  });

  ifNotWin32It(`should support FileHandle.chmod`, async () => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    await xfs.mktempPromise(async dir => {
      const p = npath.join(npath.fromPortablePath(dir), `foo.txt`);

      const fd = await patchedFs.promises.open(p, `w`);
      await fd.chmod(0o744);
      expect((await fd.stat()).mode & 0o777).toBe(0o744);
      await fd.close();
    });
  });
});
