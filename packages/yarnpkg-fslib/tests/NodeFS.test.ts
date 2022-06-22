import {NodeFS}            from '../sources/NodeFS';
import {xfs, PortablePath} from '../sources';

const nodeFs = new NodeFS();

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
      xfs.mktempSync(async dir => {
        const p = `${dir}/foo.txt` as PortablePath;
        nodeFs.writeFileSync(p, `foo`);

        const fd =  nodeFs.openSync(p, `r+`);
        nodeFs.ftruncateSync(fd, 2);
        nodeFs.closeSync(fd);

        expect(nodeFs.readFileSync(p, `utf8`)).toEqual(`fo`);
      });
    });
  });
});
