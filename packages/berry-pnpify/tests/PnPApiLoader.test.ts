import { PnPApiLoader } from '../sources/PnPApiLoader';

describe('PnPApiLoader should', () => {
  let mockWatch: jest.Mock;
  let mockUncachedRequire: jest.Mock;
  let loader: PnPApiLoader;

  beforeEach(() => {
    mockWatch = jest.fn();
    mockUncachedRequire = jest.fn().mockReturnValue({});
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
    expect(mockWatch).toHaveBeenCalledTimes(1);
    expect(mockUncachedRequire).toHaveBeenCalledTimes(1);
    expect(mockListener).toHaveBeenCalledWith(filePath);
  });

  it('requires api again on file change', () => {
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
    expect(mockListener).toHaveBeenCalledWith(filePath);
  });
});
