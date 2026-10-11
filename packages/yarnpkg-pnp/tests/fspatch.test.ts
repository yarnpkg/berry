type FakeFsBinding = {
  fstat: () => Float64Array;
  readFileUtf8: (path: string, flag: number) => string;
};

// Mostly an arbitrary number - Just enough calls such that the we're obviously reaching into infinite recursion
const MAX_FS_READ_CALLS = 6;

const O_RDONLY = 0;

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetModules();
});

describe(`fspatch`, () => {
  it(`should not recurse when fs.readFileSync calls back into the patched utf8 binding`, () => {
    const binding: FakeFsBinding = {
      fstat: () => new Float64Array(),
      readFileUtf8(path: string) {
        return `fake contents of ${path}`;
      },
    };

    let fsReadCalls = 0;

    // Note: Needs to mimic Node's utf8 fast path where `fs.readFileSync` goes straight back to `binding.readFileUtf8`
    const fakeFs = {
      readFileSync: (path: string, options: {flag: number}) => {
        fsReadCalls += 1;
        if (fsReadCalls > MAX_FS_READ_CALLS)
          throw new Error(`fs.readFileSync was called more than ${MAX_FS_READ_CALLS} times - fspatch is probably recursing infinitely`);


        return binding.readFileUtf8(path, options.flag);
      },
    };

    jest.spyOn(process as unknown as {binding: (name: string) => unknown}, `binding`).mockReturnValue(binding);
    jest.doMock(`fs`, () => fakeFs);
    jest.doMock(`../sources/esm-loader/loaderFlags`, () => ({HAS_LAZY_LOADED_TRANSLATORS: false}));

    jest.isolateModules(() => {
      require(`../sources/esm-loader/fspatch`);
    });

    const result = binding.readFileUtf8(`/foo.js`, O_RDONLY);

    // Note: fspatch swallows errors from fs.readFileSync, so the recursion limit error
    // never surfaces on its own - hence checking the flag and call count instead
    const isInfinitelyRecursing = fsReadCalls < MAX_FS_READ_CALLS;

    expect(isInfinitelyRecursing).toBe(false);
    expect(fsReadCalls).toBe(1);
    expect(result).toBe(`contents of /foo.js`);
  });
});
