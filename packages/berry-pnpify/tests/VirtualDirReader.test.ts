import { VirtualDirReader } from '../sources/VirtualDirReader';

describe('VirtualDirReader should', () => {
  let dirReader: VirtualDirReader;
  beforeEach(() => {
    dirReader = new VirtualDirReader();
  });

  it('return null if there is no issuer info', () => {
    expect(dirReader.readDir({})).toBeNull();
  });

  it('return null for fully resolved pnp path', () => {
    expect(dirReader.readDir({ resolvedPath: 'abc' })).toBeNull();
  });

  it('return null if there is no package dependencies', () => {
    const pnpPath = { issuer: 'foo', issuerInfo: { packageLocation: '', packageDependencies: new Map() }, request: '' };
    expect(dirReader.readDir(pnpPath)).toBeNull();
  });

  it('return package dependencies list for /node_modules virtual dir', () => {
    const pnpPath = { issuer: 'foo', issuerInfo: { packageLocation: '', packageDependencies: new Map([
      ['foo', '1.0.0'],
      ['bar', '1.0.0']
    ]) }, request: '' };
    expect(dirReader.readDir(pnpPath)).toEqual(['foo', 'bar']);
  });

  it('return package dependencies list for /node_modules/@scope virtual dir', () => {
    const pnpPath = { issuer: 'foo', issuerInfo: { packageLocation: '', packageDependencies: new Map([
      ['foo', '1.0.0'],
      ['bar', '1.0.0'],
      ['@scope/a', '1.0.0'],
      ['@scope/b', '1.0.0']
    ]) }, request: '@scope' };
    expect(dirReader.readDir(pnpPath)).toEqual(['a', 'b']);
  });

  it('return scoped packages one time for /node_modules virtual dir', () => {
    const pnpPath = { issuer: 'foo', issuerInfo: { packageLocation: '', packageDependencies: new Map([
      ['foo', '1.0.0'],
      ['bar', '1.0.0'],
      ['@scope/a', '1.0.0'],
      ['@scope/b', '1.0.0']
    ]) }, request: '' };
    expect(dirReader.readDir(pnpPath)).toEqual(['foo', 'bar', '@scope']);
  });
});
