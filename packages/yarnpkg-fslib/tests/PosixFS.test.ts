import {PosixFS}              from '../sources/PosixFS';
import {xfs, npath, Filename} from '../sources';

const posixFs = new PosixFS(xfs);

describe(`PosixFS`, () => {
  it(`should support PathBuffers`, async () => {
    const tmpdir = await xfs.mktempPromise();

    const path = npath.join(npath.fromPortablePath(tmpdir), `file.txt` as Filename);
    const pathBuffer = new npath.PathBuffer(path);

    await posixFs.writeFilePromise(pathBuffer, `...`);

    await expect(posixFs.readFilePromise(path, `utf8`)).resolves.toStrictEqual(`...`);
    await expect(posixFs.readFilePromise(pathBuffer, `utf8`)).resolves.toStrictEqual(`...`);
  });

  it(`should support FileURLs`, async () => {
    const tmpdir = await xfs.mktempPromise();

    const path = npath.join(npath.fromPortablePath(tmpdir), `file.txt` as Filename);
    const url = new npath.FileURL(path);

    await posixFs.writeFilePromise(url, `...`);

    await expect(posixFs.readFilePromise(path, `utf8`)).resolves.toStrictEqual(`...`);
    await expect(posixFs.readFilePromise(url, `utf8`)).resolves.toStrictEqual(`...`);
  });
});
