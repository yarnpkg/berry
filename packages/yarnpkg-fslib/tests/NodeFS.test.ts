import {NodeFS}                             from '../sources/NodeFS';
import {xfs, PortablePath, ppath, Filename} from '../sources';

const nodeFs = new NodeFS();

const ifNotWin32It = process.platform !== `win32` ? it : it.skip;

describe(`NodeFS`, () => {
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
      const p = ppath.join(dir, `foo.txt` as Filename);
      await nodeFs.writeFilePromise(p, ``);

      const fd = await nodeFs.openPromise(p, `w`);
      await nodeFs.fchmodPromise(fd, 0o744);
      await nodeFs.closePromise(fd);

      expect((await nodeFs.statPromise(p)).mode & 0o777).toBe(0o744);
    });
  });

  ifNotWin32It(`should support fchmodSync`, () => {
    xfs.mktempSync(dir => {
      const p = ppath.join(dir, `bar.txt` as Filename);
      nodeFs.writeFileSync(p, ``);

      const fd = nodeFs.openSync(p, `w`);
      nodeFs.fchmodSync(fd, 0o744);
      nodeFs.closeSync(fd);

      expect((nodeFs.statSync(p)).mode & 0o777).toBe(0o744);
    });
  });
});
