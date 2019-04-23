import { PnPApiLocator } from '../sources/PnPApiLocator';

describe('PnPApiLocator should', () => {
  let mockExistsSync: jest.Mock;
  let locator: PnPApiLocator;
  beforeEach(() => {
    mockExistsSync = jest.fn((pathname) => {
      const result = '/home/user/pnp_project/.pnp.js'.indexOf(pathname) === 0 || '/home/user/some_dir/pnp_project/.pnp.js'.indexOf(pathname) === 0;
      return result;
    });
    locator = new PnPApiLocator({
      existsSync: mockExistsSync
    });
  });

  it('detect root of a pnp project', () => {
    expect(locator.findApi('/home/user/pnp_project/some_dir/some_file.js')).toEqual('/home/user/pnp_project/.pnp.js');
  });

  it('report null if folder is not inside pnp project', () => {
    expect(locator.findApi('/home/user/non_pnp_project/some_dir/some_file.js')).toEqual(null);
  });

  it('not check again the locations it has already checked', () => {
    locator.findApi('/home/user/pnp_project/some_dir/some_file.js');
    const lastCheckCount = mockExistsSync.mock.calls.length;
    locator.findApi('/home/user/some_file.js');
    expect(mockExistsSync).toHaveBeenCalledTimes(lastCheckCount + 1);
  });

  it('not do extra checks for folders inside pnp root', () => {
    locator.findApi('/home/user/pnp_project/some_dir/some_file.js');
    const lastCheckCount = mockExistsSync.mock.calls.length;
    locator.findApi('/home/user/pnp_project/some_dir/some_other_dir');
    expect(mockExistsSync).toHaveBeenCalledTimes(lastCheckCount);
  })

  it('not do extra checks for folders inside node_modules', () => {
    locator.findApi('/home/user');
    const lastCheckCount = mockExistsSync.mock.calls.length;
    locator.findApi('/home/user/node_modules/a/b/c/d/e');
    expect(mockExistsSync).toHaveBeenCalledTimes(lastCheckCount);
  });

  it('finds pnp roots for two different pnp projects', () => {
    expect(locator.findApi('/home/user/pnp_project/some_dir/some_file.js')).toEqual('/home/user/pnp_project/.pnp.js');
    expect(locator.findApi('/home/user/some_dir/pnp_project/other_dir/some_file.js')).toEqual('/home/user/some_dir/pnp_project/.pnp.js');
  });

  it('support invalidating all the cache', () => {
    locator.findApi('/home/user/pnp_project/some_dir/some_file.js');
    const lastCheckCount = mockExistsSync.mock.calls.length;
    locator.invalidatePath('/');
    locator.findApi('/home/user/pnp_project/some_dir/some_file.js');
    expect(mockExistsSync).toHaveBeenCalledTimes(lastCheckCount * 2);
  });

  it('support partial cache invalidation', () => {
    locator.findApi('/home/user/pnp_project');
    const lastCheckCount = mockExistsSync.mock.calls.length;
    locator.invalidatePath('/home/user/pnp_project');
    locator.findApi('/home/user/pnp_project/some_dir/some_file.js');
    expect(mockExistsSync).toHaveBeenCalledTimes(lastCheckCount + 1);
  });
});
