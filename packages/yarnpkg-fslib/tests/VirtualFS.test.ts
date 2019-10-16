import {VirtualFS}              from '../sources/VirtualFS';
import {Filename, npath, ppath} from '../sources/path';
import {xfs}                    from '../sources';

describe(`VirtualFS`, () => {
  it(`should allow access to a directory through its virtual subfolder`, () => {
    const virtualPath = ppath.join(npath.toPortablePath(__dirname), `virtual` as Filename);

    const virtualFs = new VirtualFS(virtualPath);
    expect(virtualFs.readdirSync(virtualPath)).toContain(`VirtualFS.test.ts`);
  });

  it(`should allow access to a directory through its virtual components`, () => {
    const virtualPath = ppath.join(npath.toPortablePath(__dirname), `virtual` as Filename);
    const virtualEntry = ppath.join(virtualPath, `12345` as Filename);

    const virtualFs = new VirtualFS(virtualPath);
    expect(virtualFs.readdirSync(virtualEntry)).toContain(`VirtualFS.test.ts`);
  });

  it(`should allow access to a directory through its depth marker`, () => {
    const virtualPath = ppath.join(npath.toPortablePath(__dirname), `virtual` as Filename);
    const virtualEntry = ppath.join(virtualPath, `12345` as Filename, `0` as Filename);

    const virtualFs = new VirtualFS(virtualPath);
    expect(virtualFs.readdirSync(virtualEntry)).toContain(`VirtualFS.test.ts`);
  });

  it(`should allow access to a directory parent through its depth marker`, () => {
    const virtualPath = ppath.join(npath.toPortablePath(__dirname), `virtual` as Filename);
    const virtualEntry = ppath.join(virtualPath, `12345` as Filename, `1` as Filename);

    const virtualFs = new VirtualFS(virtualPath);
    expect(virtualFs.readdirSync(virtualEntry)).toContain(`package.json`);
  });

  it(`should allow reading a file through its virtual path (depth=0)`, () => {
    const virtualPath = ppath.join(npath.toPortablePath(__dirname), `virtual` as Filename);
    const virtualEntry = ppath.join(virtualPath, `12345` as Filename, `0` as Filename);

    const virtualFs = new VirtualFS(virtualPath);

    const virtualContent = virtualFs.readFileSync(ppath.join(virtualEntry, `VirtualFS.test.ts` as Filename));
    const physicalContent = xfs.readFileSync(ppath.join(ppath.dirname(virtualPath), `VirtualFS.test.ts` as Filename));

    expect(virtualContent).toEqual(physicalContent);
  });

  it(`should allow reading a file through its virtual path (depth=1)`, () => {
    const virtualPath = ppath.join(npath.toPortablePath(__dirname), `virtual` as Filename);
    const virtualEntry = ppath.join(virtualPath, `12345` as Filename, `1` as Filename);

    const virtualFs = new VirtualFS(virtualPath);

    const virtualContent = virtualFs.readFileSync(ppath.join(virtualEntry, `package.json` as Filename));
    const physicalContent = xfs.readFileSync(ppath.join(ppath.dirname(ppath.dirname(virtualPath)), `package.json` as Filename));

    expect(virtualContent).toEqual(physicalContent);
  });

  it(`should preserve the virtual path across realpath (virtual directory)`, () => {
    const virtualPath = ppath.join(npath.toPortablePath(__dirname), `virtual` as Filename);

    const virtualFs = new VirtualFS(virtualPath);
    expect(virtualFs.realpathSync(virtualPath)).toEqual(virtualPath);
  });

  it(`should preserve the virtual path across realpath (virtual component)`, () => {
    const virtualPath = ppath.join(npath.toPortablePath(__dirname), `virtual` as Filename);
    const virtualEntry = ppath.join(virtualPath, `12345` as Filename);

    const virtualFs = new VirtualFS(virtualPath);
    expect(virtualFs.realpathSync(virtualEntry)).toEqual(virtualEntry);
  });

  it(`should preserve the virtual path across realpath (depth marker)`, () => {
    const virtualPath = ppath.join(npath.toPortablePath(__dirname), `virtual` as Filename);
    const virtualEntry = ppath.join(virtualPath, `12345` as Filename, `0` as Filename);

    const virtualFs = new VirtualFS(virtualPath);
    expect(virtualFs.realpathSync(virtualEntry)).toEqual(virtualEntry);
  });

  it(`should preserve the virtual path across realpath (virtual file)`, () => {
    const virtualPath = ppath.join(npath.toPortablePath(__dirname), `virtual` as Filename);
    const virtualEntry = ppath.join(virtualPath, `12345` as Filename, `0` as Filename, `VirtualFS.test.ts` as Filename);

    const virtualFs = new VirtualFS(virtualPath);
    expect(virtualFs.realpathSync(virtualEntry)).toEqual(virtualEntry);
  });
});
