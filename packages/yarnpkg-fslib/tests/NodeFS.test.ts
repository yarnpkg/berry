import {NodeFS}                   from '../sources/NodeFS';
import {xfs, PortablePath, ppath} from '../sources';

const nodeFs = new NodeFS();

const ifAtLeastNode20It = !process.version.match(/^v1[89]\./) ? it : it.skip;
const ifNotWin32It = process.platform !== `win32` ? it : it.skip;

describe(`NodeFS`, () => {
  describe(`opendir`, () => {
    it(`shouldn't crash`, async () => {
      // The `path` property of fs.Dir only has a getter; if our implementation
      // overrides it, it'll crash (we need to defineProperty it instead). This
      // test makes sure we don't accidentally remove it.

      const tmpdir = await xfs.mktempPromise();
      await xfs.writeFilePromise(ppath.join(tmpdir, `foo`), ``);

      const dir1 = xfs.opendirSync(tmpdir);
      expect(dir1.path).toEqual(tmpdir);
      expect(dir1.readSync()).toMatchObject({
        name: `foo`,
      });

      const dir2 = await xfs.opendirPromise(tmpdir);
      expect(dir2.path).toEqual(tmpdir);
      await expect(dir2.read()).resolves.toMatchObject({
        name: `foo`,
      });
    });
  });

  describe(`readdir`, () => {
    ifAtLeastNode20It(`should support recursive directory listing`, async () => {
      const tmpdir = await xfs.mktempPromise();

      await xfs.mkdirPromise(ppath.join(tmpdir, `foo`));

      await xfs.writeFilePromise(ppath.join(tmpdir, `foo/hello`), ``);
      await xfs.writeFilePromise(ppath.join(tmpdir, `foo/world`), ``);

      expect((await nodeFs.readdirPromise(tmpdir, {recursive: true})).sort()).toEqual([`foo`, `foo/hello`, `foo/world`]);
      expect((nodeFs.readdirSync(tmpdir, {recursive: true})).sort()).toEqual([`foo`, `foo/hello`, `foo/world`]);
    });
  });

  describe(`copyPromise`, () => {
    it(`should support copying files`, async () => {
      const tmpdir = await xfs.mktempPromise();

      const source = `${tmpdir}/foo` as PortablePath;
      const destination = `${tmpdir}/bar` as PortablePath;

      const sourceContent = `Hello World`;

      await nodeFs.writeFilePromise(source, sourceContent);

      await nodeFs.copyPromise(destination, source);

      await expect(nodeFs.readFilePromise(source, `utf8`)).resolves.toStrictEqual(sourceContent);
      await expect(nodeFs.readFilePromise(destination, `utf8`)).resolves.toStrictEqual(sourceContent);
    });

    it(`should support copying files (overwrite)`, async () => {
      const tmpdir = await xfs.mktempPromise();

      const source = `${tmpdir}/foo` as PortablePath;
      const destination = `${tmpdir}/bar` as PortablePath;

      const sourceContent = `Hello World`;
      const destinationContent = `Goodbye World`;

      await nodeFs.writeFilePromise(source, sourceContent);
      await nodeFs.writeFilePromise(destination, destinationContent);

      await nodeFs.copyPromise(destination, source);

      await expect(nodeFs.readFilePromise(source, `utf8`)).resolves.toStrictEqual(sourceContent);
      await expect(nodeFs.readFilePromise(destination, `utf8`)).resolves.toStrictEqual(sourceContent);
    });

    it(`should support ftruncatePromise`, async () => {
      await xfs.mktempPromise(async dir => {
        const p = `${dir}/foo.txt` as PortablePath;
        await nodeFs.writeFilePromise(p, `foo`);

        const fd = await nodeFs.openPromise(p, `r+`);
        await nodeFs.ftruncatePromise(fd, 2);
        await nodeFs.closePromise(fd);

        await expect(nodeFs.readFilePromise(p, `utf8`)).resolves.toEqual(`fo`);
      });
    });

    it(`should support ftruncateSync`, () => {
      xfs.mktempSync(dir => {
        const p = `${dir}/foo.txt` as PortablePath;
        nodeFs.writeFileSync(p, `foo`);

        const fd =  nodeFs.openSync(p, `r+`);
        nodeFs.ftruncateSync(fd, 2);
        nodeFs.closeSync(fd);

        expect(nodeFs.readFileSync(p, `utf8`)).toEqual(`fo`);
      });
    });
  });

  ifNotWin32It(`should support fchmodPromise`, async () => {
    await xfs.mktempPromise(async dir => {
      const p = ppath.join(dir, `foo.txt`);
      await nodeFs.writeFilePromise(p, ``);

      const fd = await nodeFs.openPromise(p, `w`);
      await nodeFs.fchmodPromise(fd, 0o744);
      await nodeFs.closePromise(fd);

      expect((await nodeFs.statPromise(p)).mode & 0o777).toBe(0o744);
    });
  });

  ifNotWin32It(`should support fchmodSync`, () => {
    xfs.mktempSync(dir => {
      const p = ppath.join(dir, `bar.txt`);
      nodeFs.writeFileSync(p, ``);

      const fd = nodeFs.openSync(p, `w`);
      nodeFs.fchmodSync(fd, 0o744);
      nodeFs.closeSync(fd);

      expect((nodeFs.statSync(p)).mode & 0o777).toBe(0o744);
    });
  });
});
