import { NodeFS } from '../sources/NodeFS';

describe('NodeFS fromPortable/toPortablePath should', () => {
  it('not change abs Posix path when producing portable path', () => {
    const inputPath = '/home/user/proj';
    expect(NodeFS.toPortablePath(inputPath)).toEqual(inputPath);
  })

  it('not change non-portable abs Posix path when producing native path', () => {
    const inputPath = '/home/user/proj';
    expect(NodeFS.fromPortablePath(inputPath)).toEqual(inputPath);
  });

  it('properly translate abs Windows path', () => {
    const inputPath = 'C:\\Users\\user\\proj';
    const outputPath = '/mnt/C/Users/user/proj';
    expect(NodeFS.toPortablePath(inputPath)).toEqual(outputPath);
    expect(NodeFS.fromPortablePath(outputPath)).toEqual(inputPath);
  })

  it('properly translate abs Windows path with forward slashes', () => {
    const inputPath = 'C:/Users/user/proj';
    const outputPath = '/mnt/C/Users/user/proj';
    expect(NodeFS.toPortablePath(inputPath)).toEqual(outputPath);
    expect(NodeFS.fromPortablePath(outputPath)).toEqual('C:\\Users\\user\\proj');
  })

  it('properly translate abs Windows path with drive letter in lower case', () => {
    const inputPath = 'c:\\Users\\user\\proj';
    const outputPath = '/mnt/c/Users/user/proj';
    expect(NodeFS.toPortablePath(inputPath)).toEqual(outputPath);
    expect(NodeFS.fromPortablePath(outputPath)).toEqual(inputPath);
  })

  it('treat mixed abs path as Windows path', () => {
    const inputPath = 'C:/Users\\user\\proj/foo/bar';
    const outputPath = '/mnt/C/Users/user/proj/foo/bar';
    expect(NodeFS.toPortablePath(inputPath)).toEqual(outputPath);
    expect(NodeFS.fromPortablePath(outputPath)).toEqual('C:\\Users\\user\\proj\\foo\\bar');
  });

  it('not change abs path when it is already portable', () => {
    const inputPath = '/mnt/c/Users/user/proj';
    const outputPath = '/mnt/c/Users/user/proj';
    expect(NodeFS.toPortablePath(inputPath)).toEqual(outputPath);
  });

  it('not change abs path when it is already Windows', () => {
    const inputPath = 'c:\\Users\\user\\proj';
    expect(NodeFS.fromPortablePath(inputPath)).toEqual(inputPath);
  });

  it('normalize mixed rel Windows path and leaves it in Posix format', () => {
    const inputPath = '..\\Users\\user/proj';
    const outputPath = '../Users/user/proj';
    expect(NodeFS.toPortablePath(inputPath)).toEqual(outputPath);
    expect(NodeFS.fromPortablePath(outputPath)).toEqual(outputPath);
  });

  it('not change rel pathes in Posix format', () => {
    const inputPath = './user/proj';
    expect(NodeFS.toPortablePath(inputPath)).toEqual(inputPath);
    expect(NodeFS.fromPortablePath(inputPath)).toEqual(inputPath);
  });
});
