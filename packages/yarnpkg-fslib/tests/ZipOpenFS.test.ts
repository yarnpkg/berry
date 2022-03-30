import {getLibzipSync}                        from '@yarnpkg/libzip';

import {getArchivePart}                       from '../sources/ZipOpenFS';
import {ppath, npath, Filename, PortablePath} from '../sources/path';
import {ZipOpenFS}                            from '../sources';

import {useFakeTime}                          from './utils';

export const ZIP_DIR1 = ppath.join(
  npath.toPortablePath(__dirname),
  `fixtures/foo.zip` as Filename,
);
export const ZIP_DIR2 = ppath.join(
  npath.toPortablePath(__dirname),
  `fixtures/folder.zip/foo.zip` as Filename,
);
export const ZIP_DIR3 = ppath.join(
  npath.toPortablePath(__dirname),
  `fixtures/foo.hiddenzip` as Filename,
);

export const ZIP_FILE1 = ppath.join(ZIP_DIR1, `foo.txt` as Filename);
export const ZIP_FILE2 = ppath.join(ZIP_DIR2, `foo.txt` as Filename);
export const ZIP_FILE3 = ppath.join(ZIP_DIR3, `foo.txt` as Filename);

describe(`getArchivePart`, () => {
  const tests = [
    [`.zip`, null],
    [`foo`, null],
    [`foo.zip`, `foo.zip`],
    [`foo.zip/bar`, `foo.zip`],
    [`foo.zip/bar/baz`, `foo.zip`],
    [`/a/b/c/foo.zip`, `/a/b/c/foo.zip`],
    [`./a/b/c/foo.zip`, `./a/b/c/foo.zip`],
    [`./a/b/c/.zip`, null],
    [`./a/b/c/foo.zipp`, null],
    [`./a/b/c/foo.zip/bar/baz/qux.zip`, `./a/b/c/foo.zip`],
    [`./a/b/c/foo.zip-bar.zip`, `./a/b/c/foo.zip-bar.zip`],
    [`./a/b/c/foo.zip-bar.zip/bar/baz/qux.zip`, `./a/b/c/foo.zip-bar.zip`],
    [`./a/b/c/foo.zip-bar/foo.zip-bar/foo.zip-bar.zip/d`, `./a/b/c/foo.zip-bar/foo.zip-bar/foo.zip-bar.zip`],
  ] as const;

  for (const [path, result] of tests) {
    test(`getArchivePart(${JSON.stringify(path)}) === ${JSON.stringify(result)}`, () => {
      expect(getArchivePart(path, `.zip`)).toStrictEqual(result);
    });
  }
});

describe(`ZipOpenFS`, () => {
  it(`can read from a zip file`, () => {
    const fs = new ZipOpenFS({libzip: getLibzipSync()});

    expect(fs.readFileSync(ZIP_FILE1, `utf8`)).toEqual(`foo\n`);

    fs.discardAndClose();
  });

  it(`can read from a zip file in a path containing .zip`, () => {
    const fs = new ZipOpenFS({libzip: getLibzipSync()});

    expect(fs.readFileSync(ZIP_FILE2, `utf8`)).toEqual(`foo\n`);

    fs.discardAndClose();
  });

  it(`can read from a zip file with an unusual extension if so configured`, () => {
    const fs = new ZipOpenFS({libzip: getLibzipSync(), fileExtensions: [`.hiddenzip`]});

    expect(fs.readFileSync(ZIP_FILE3, `utf8`)).toEqual(`foo\n`);

    fs.discardAndClose();
  });

  it(`throws when reading from a zip file with an unusual extension`, () => {
    const fs = new ZipOpenFS({libzip: getLibzipSync()});

    expect(() => {
      fs.readFileSync(ZIP_FILE3, `utf8`);
    }).toThrowError();

    fs.discardAndClose();
  });

  it(`doesn't close a ZipFS instance with open handles`, () => {
    const fs = new ZipOpenFS({libzip: getLibzipSync(), maxOpenFiles: 1});

    const fileHandle = fs.openSync(ZIP_FILE1, ``);

    expect(fs.readFileSync(ZIP_FILE2, `utf8`)).toEqual(`foo\n`);

    const buff = Buffer.alloc(4);
    fs.readSync(fileHandle, buff, 0, 4, 0);
    fs.closeSync(fileHandle);

    expect(buff.toString(`utf8`)).toEqual(`foo\n`);

    fs.discardAndClose();
  });

  it(`sets the path property of the stream object returned by createReadStream to the normalized native version of the input path`, async () => {
    const fs = new ZipOpenFS({libzip: getLibzipSync(), maxOpenFiles: 1});

    const unnormalizedPortablePath = ZIP_FILE1.replace(/\//g, `/./`) as PortablePath;
    const normalizedNativePath = npath.fromPortablePath(ZIP_FILE1);

    const stream = fs.createReadStream(unnormalizedPortablePath);

    expect(stream.path).toMatch(normalizedNativePath);

    stream.destroy();
    fs.discardAndClose();
  });

  it(`treats createReadStream as an open file handle`, async () => {
    const fs = new ZipOpenFS({libzip: getLibzipSync(), maxOpenFiles: 1});

    const chunks: Array<Buffer> = [];
    await new Promise<void>(resolve => {
      let done = 0;

      fs.createReadStream(ZIP_FILE1)
        .on(`data`, (chunk: Buffer) => {
          chunks.push(chunk);
        })
        .on(`close`, () => {
          if (++done === 2) {
            resolve();
          }
        });

      fs.createReadStream(ZIP_FILE2)
        .on(`data`, (chunk: Buffer) => {
          chunks.push(chunk);
        })
        .on(`close`, () => {
          if (++done === 2) {
            resolve();
          }
        });
    });

    expect(chunks[0].toString(`utf8`)).toMatch(`foo\n`);
    expect(chunks[1].toString(`utf8`)).toMatch(`foo\n`);

    fs.discardAndClose();
  });

  it(`treats createWriteStream as an open file handle`, async () => {
    const fs = new ZipOpenFS({libzip: getLibzipSync(), maxOpenFiles: 1});

    const stream1 = fs.createWriteStream(ZIP_FILE1);
    const stream2 = fs.createWriteStream(ZIP_FILE2);

    await new Promise<void>(resolve => {
      let done = 0;
      stream1.end(`foo`, () => {
        if (++done === 2) {
          resolve();
        }
      });
      stream2.end(`bar`, () => {
        if (++done === 2) {
          resolve();
        }
      });
    });

    fs.discardAndClose();
  });

  it(`closes ZipFS instances once they become stale`, async () => {
    await useFakeTime(async advanceTimeBy => {
      const fs = new ZipOpenFS({libzip: getLibzipSync(), maxAge: 2000});

      await fs.existsPromise(ZIP_FILE1);
      // @ts-expect-error: zipInstances is private
      expect(fs.zipInstances!.size).toEqual(1);

      advanceTimeBy(1000);

      fs.existsSync(ZIP_FILE2);
      // @ts-expect-error: zipInstances is private
      expect(fs.zipInstances!.size).toEqual(2);

      advanceTimeBy(1000);

      // @ts-expect-error: zipInstances is private
      expect(fs.zipInstances!.size).toEqual(1);

      advanceTimeBy(1000);

      // @ts-expect-error: zipInstances is private
      expect(fs.zipInstances!.size).toEqual(0);

      fs.discardAndClose();
    });
  });

  it(`doesn't close zip files while they are in use`, async () => {
    const fs = new ZipOpenFS({libzip: getLibzipSync(), maxOpenFiles: 1});

    await Promise.all([
      fs.readFilePromise(ZIP_FILE1),
      fs.realpathPromise(ZIP_FILE1),
      fs.readFilePromise(ZIP_FILE2),
      fs.realpathPromise(ZIP_FILE2),
    ]);

    fs.discardAndClose();
  });

  it(`doesn't crash when watching a file in a archive that gets closed`, async () => {
    await useFakeTime(advanceTimeBy => {
      const fs = new ZipOpenFS({libzip: getLibzipSync(), maxOpenFiles: 1});

      fs.watchFile(ZIP_FILE1, (current, previous) => {});
      fs.watchFile(ZIP_FILE2, (current, previous) => {});

      advanceTimeBy(100);

      fs.discardAndClose();
    });
  });

  it(`treats Dir instances opened via opendir as open file handles`, () => {
    const fs = new ZipOpenFS({libzip: getLibzipSync(), maxOpenFiles: 1});

    const dir1 = fs.opendirSync(ZIP_DIR1);
    const dir2 = fs.opendirSync(ZIP_DIR2);

    expect(dir1.readSync()!.name).toStrictEqual(`foo.txt`);
    expect(dir2.readSync()!.name).toStrictEqual(`foo.txt`);

    fs.discardAndClose();
  });
});
