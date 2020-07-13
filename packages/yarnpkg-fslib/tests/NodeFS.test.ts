import {NodeFS}               from '../sources/NodeFS';
import {xfs, ppath, Filename} from '../sources';

const nodeFs = new NodeFS();

describe(`NodeFS`, () => {
  it(`should support PathBuffers`, async () => {
    const tmpdir = await xfs.mktempPromise();

    const pathBuffer = new ppath.PathBuffer(ppath.join(tmpdir, `file.txt` as Filename));

    await nodeFs.writeFilePromise(pathBuffer, `...`);

    await expect(nodeFs.readFilePromise(pathBuffer, `utf8`)).resolves.toStrictEqual(`...`);
  });

  it(`should support FileURLs`, async () => {
    const tmpdir = await xfs.mktempPromise();

    const url = new ppath.FileURL(ppath.join(tmpdir, `file.txt` as Filename));

    await nodeFs.writeFilePromise(url, `...`);

    await expect(nodeFs.readFilePromise(url, `utf8`)).resolves.toStrictEqual(`...`);
  });
});
