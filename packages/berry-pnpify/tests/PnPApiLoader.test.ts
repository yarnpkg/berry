import { PnPApiLoader } from '../sources/PnPApiLoader';

describe('PnPApiLoader should', () => {
  let mockWatch: jest.Mock;
  let mockUncachedRequire: jest.Mock;
  let loader: PnPApiLoader;

  beforeEach(() => {
    mockWatch = jest.fn();
    mockUncachedRequire = jest.fn().mockReturnValue({ findPackageLocation: () => {} });
    loader = new PnPApiLoader({
      watch: mockWatch,
      uncachedRequire: mockUncachedRequire
    });
  });

  it('loads PnP API and starts watcher', () => {
    loader.getApi('/home/user/pnp_project/.pnp.js');
    expect(mockWatch).toHaveBeenCalledTimes(1);
    expect(mockUncachedRequire).toHaveBeenCalledTimes(1);
  });

  it('loads PnP API in a cached way', () => {
    loader.getApi('/home/user/pnp_project/.pnp.js');
    loader.getApi('/home/user/pnp_project/.pnp.js');
    expect(mockWatch).toHaveBeenCalledTimes(1);
    expect(mockUncachedRequire).toHaveBeenCalledTimes(1);
  });

  it('emits watch event on file change', () => {
    let pnpFileChangeCallback: any;
    mockWatch = jest.fn().mockImplementation((_, cb) => {
      pnpFileChangeCallback = cb;
    });
    loader = new PnPApiLoader({
      watch: mockWatch,
      uncachedRequire: mockUncachedRequire
    });
    const filePath = '/home/user/pnp_project/.pnp.js';
    const mockListener = jest.fn();
    loader.on('change', mockListener);
    loader.getApi(filePath);
    if (pnpFileChangeCallback) {
      pnpFileChangeCallback('change', filePath);
    }
    expect(mockWatch).toHaveBeenCalledTimes(1);
    expect(mockUncachedRequire).toHaveBeenCalledTimes(2);
    expect(mockListener).toHaveBeenCalledWith(filePath);
  });

  it('requires api again on file change', () => {
    let pnpFileChangeCallback: any;
    mockWatch = jest.fn().mockImplementation((_, cb) => {
      pnpFileChangeCallback = cb;
    });
    mockUncachedRequire = jest.fn()
      .mockReturnValueOnce({ findPackageLocator: () => 'loc1' })
      .mockReturnValueOnce({ findPackageLocator: () => 'loc2' });
    loader = new PnPApiLoader({
      watch: mockWatch,
      uncachedRequire: mockUncachedRequire
    });
    const filePath = '/home/user/pnp_project/.pnp.js';
    const mockListener = jest.fn();
    loader.on('change', mockListener);
    const api1 = loader.getApi(filePath);
    expect(api1.findPackageLocator('')).toEqual('loc1');
    if (pnpFileChangeCallback) {
      pnpFileChangeCallback('change', filePath);
    }
    const api2 = loader.getApi(filePath);
    expect(api2.findPackageLocator('')).toEqual('loc2');
    expect(mockWatch).toHaveBeenCalledTimes(1);
    expect(mockUncachedRequire).toHaveBeenCalledTimes(2);
    expect(mockListener).toHaveBeenCalledWith(filePath);
  });

  it('does not emit event when API object is empty', () => {
    mockUncachedRequire = jest.fn().mockReturnValue({});
    mockWatch = jest.fn().mockImplementation((filename, callback) => {
      callback('change', filename);
    });
    loader = new PnPApiLoader({
      watch: mockWatch,
      uncachedRequire: mockUncachedRequire
    });
    const filePath = '/home/user/pnp_project/.pnp.js';
    const mockListener = jest.fn();
    loader.on('change', mockListener);
    loader.getApi(filePath);
    loader.getApi(filePath);
    expect(mockWatch).toHaveBeenCalledTimes(1);
    expect(mockUncachedRequire).toHaveBeenCalledTimes(2);
    expect(mockListener).toHaveBeenCalledTimes(0);
  });
});
