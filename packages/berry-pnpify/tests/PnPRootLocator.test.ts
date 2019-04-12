import { PnPRootLocator } from '../sources/PnPRootLocator';

describe('PnPRootLocator should', () => {
  let locator;
  let checkCount;
  beforeEach(() => {
    checkCount = 0;
    locator = new PnPRootLocator({
      existsSync: (pathname) => {
        checkCount++;
        const result = '/home/user/pnp_project/.pnp.js'.indexOf(pathname) === 0 || '/home/user/some_dir/pnp_project/.pnp.js'.indexOf(pathname) === 0;
        return result;
      }
    });
  });

  it('detect root of a pnp project', () => {
    expect(locator.findApiRoot('/home/user/pnp_project/some_dir/some_file.js')).toEqual('/home/user/pnp_project');
  });

  it('report null if folder is not inside pnp project', () => {
    expect(locator.findApiRoot('/home/user/non_pnp_project/some_dir/some_file.js')).toEqual(null);
  });

  it('not check again the locations it has already checked', () => {
    locator.findApiRoot('/home/user/pnp_project/some_dir/some_file.js');
    const lastCheckCount = checkCount;
    locator.findApiRoot('/home/user/some_file.js');
    expect(checkCount).toEqual(lastCheckCount + 1);
  });

  it('not do extra checks for folders inside pnp root', () => {
    locator.findApiRoot('/home/user/pnp_project/some_dir/some_file.js');
    const lastCheckCount = checkCount;
    locator.findApiRoot('/home/user/pnp_project/some_dir/some_other_dir');
    expect(checkCount).toEqual(lastCheckCount);
  })

  it('not do extra checks for folders inside node_modules', () => {
    locator.findApiRoot('/home/user');
    const lastCheckCount = checkCount;
    locator.findApiRoot('/home/user/node_modules/a/b/c/d/e');
    expect(checkCount).toEqual(lastCheckCount);
  });

  it('finds pnp roots for two different pnp projects', () => {
    expect(locator.findApiRoot('/home/user/pnp_project/some_dir/some_file.js')).toEqual('/home/user/pnp_project');
    expect(locator.findApiRoot('/home/user/some_dir/pnp_project/other_dir/some_file.js')).toEqual('/home/user/some_dir/pnp_project');
  });

  it('support invalidating all the cache', () => {
    locator.findApiRoot('/home/user/pnp_project/some_dir/some_file.js');
    const lastCheckCount = checkCount;
    locator.invalidatePath('/');
    locator.findApiRoot('/home/user/pnp_project/some_dir/some_file.js');
    expect(checkCount).toEqual(lastCheckCount * 2);
  });

  it('support partial cache invalidation', () => {
    locator.findApiRoot('/home/user/pnp_project');
    const lastCheckCount = checkCount;
    locator.invalidatePath('/home/user/pnp_project');
    locator.findApiRoot('/home/user/pnp_project/some_dir/some_file.js');
    expect(checkCount).toEqual(lastCheckCount + 1);
  });
});
