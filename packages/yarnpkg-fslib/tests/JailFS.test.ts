import {JailFS, computeLevels}              from '../sources/JailFS';
import {xfs, ppath, PortablePath, Filename} from '../sources';

describe(`computeLevels`, () => {
  it(`should correctly compute the levels between 2 paths`, () => {
    const projectPath = `/path/to/project` as PortablePath;
    const workspacePath = `/path/to/project/workspace` as PortablePath;
    const nestedWorkspacePath = `/path/to/project/workspace/nested-workspace` as PortablePath;


    expect(computeLevels(workspacePath, projectPath)).toStrictEqual(1);
    expect(computeLevels(nestedWorkspacePath, projectPath)).toStrictEqual(2);
    expect(computeLevels(nestedWorkspacePath, workspacePath)).toStrictEqual(1);

    expect(computeLevels(workspacePath, workspacePath)).toStrictEqual(0);
    expect(computeLevels(projectPath, projectPath)).toStrictEqual(0);
    expect(computeLevels(nestedWorkspacePath, nestedWorkspacePath)).toStrictEqual(0);

    expect(computeLevels(projectPath, workspacePath)).toStrictEqual(0);
    expect(computeLevels(projectPath, nestedWorkspacePath)).toStrictEqual(0);
    expect(computeLevels(workspacePath, nestedWorkspacePath)).toStrictEqual(0);
  });
});

describe(`JailFS`, () => {
  it(`should not throw an error when the accessed path is inside the target folder (relative)`, async () => {
    const tmpdir = await xfs.mktempPromise();
    const jailedFolder = ppath.join(tmpdir, `jailed` as PortablePath);

    await xfs.mkdirPromise(jailedFolder);

    const jailFs = new JailFS(jailedFolder);

    await expect(
      () => jailFs.writeFilePromise(`text.txt` as Filename, `Hello World`)
    ).not.toThrow();
  });

  it(`should not throw an error when the accessed path is inside the target folder (absolute)`, async () => {
    const tmpdir = await xfs.mktempPromise();
    const jailedFolder = ppath.join(tmpdir, `jailed` as PortablePath);

    await xfs.mkdirPromise(jailedFolder);

    const jailFs = new JailFS(jailedFolder);

    await expect(
      () => jailFs.writeFilePromise(ppath.join(PortablePath.root, `text.txt` as Filename), `Hello World`)
    ).not.toThrow();
  });

  it(`should throw an error when the accessed path is not inside the target folder`, async () => {
    const tmpdir = await xfs.mktempPromise();
    const proxyFolder = ppath.join(tmpdir, `proxy` as PortablePath);
    const jailedFolder = ppath.join(proxyFolder, `jailed` as PortablePath);

    await xfs.mkdirpPromise(jailedFolder);

    const jailFs = new JailFS(jailedFolder);

    expect(
      () => jailFs.writeFilePromise(`../text.txt` as Filename, `Hello World`)
    ).toThrow(`Resolving this path (../text.txt) would escape the jail with 0 levels`);
  });

  it(`should work with levels`, async () => {
    const tmpdir = await xfs.mktempPromise();
    const proxyFolder = ppath.join(tmpdir, `proxy` as PortablePath);
    const jailedFolder = ppath.join(proxyFolder, `jailed` as PortablePath);

    await xfs.mkdirpPromise(jailedFolder);

    const jailFs = new JailFS(jailedFolder, {levels: 1});

    expect(
      () => jailFs.writeFilePromise(`text.txt` as Filename, `Hello World`)
    ).not.toThrow();

    expect(
      () => jailFs.writeFilePromise(`../text.txt` as Filename, `Hello World`)
    ).not.toThrow();

    expect(
      () => jailFs.writeFilePromise(`../../text.txt` as Filename, `Hello World`)
    ).toThrow(`Resolving this path (../../text.txt) would escape the jail with 1 levels`);
  });
});
