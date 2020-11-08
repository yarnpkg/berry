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
  });

  it(`should support any paramter type for the Node.js "exists" function`, async () => {
    await expect(xfs.existsPromise(undefined)).resolves.toBe(false);
    expect(xfs.existsSync(undefined)).toBe(false);

    await expect(xfs.existsPromise(1)).resolves.toBe(false);
    expect(xfs.existsSync(1)).toBe(false);

    await expect(xfs.existsPromise({})).resolves.toBe(false);
    expect(xfs.existsSync({})).toBe(false);
  });
});
