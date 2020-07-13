import {PosixFS}              from '../sources/PosixFS';
import {xfs, npath, Filename} from '../sources';

const posixFs = new PosixFS(xfs);

describe(`PosixFS`, () => {
  it(`should support PathBuffers`, async () => {
    const tmpdir = await xfs.mktempPromise();

    const pathBuffer = new npath.PathBuffer(npath.join(npath.fromPortablePath(tmpdir), `file.txt` as Filename));

    await posixFs.writeFilePromise(pathBuffer, `...`);

    await expect(posixFs.readFilePromise(pathBuffer, `utf8`)).resolves.toStrictEqual(`...`);
  });

  it(`should support FileURLs`, async () => {
    const tmpdir = await xfs.mktempPromise();

    const url = new npath.FileURL(npath.join(npath.fromPortablePath(tmpdir), `file.txt` as Filename));

    await posixFs.writeFilePromise(url, `...`);

    await expect(posixFs.readFilePromise(url, `utf8`)).resolves.toStrictEqual(`...`);
  });
});
