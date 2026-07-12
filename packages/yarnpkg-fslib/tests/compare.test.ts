import {CwdFS, JailFS, NodeFS, SubFS, npath, ppath} from '../sources';

const nodeFs = new NodeFS();
const pkgDir = ppath.dirname(npath.toPortablePath(__dirname));

const drives = {
  CwdFS,
  JailFS,
  SubFS,
};

const tests = {
  resolve: [{
    args: [pkgDir],
    results: {
      CwdFS: pkgDir,
      JailFS: pkgDir,
    },
  }, {
    args: [ppath.join(pkgDir, `tests`)],
    results: {
      CwdFS: ppath.join(pkgDir, `tests`),
      JailFS: ppath.join(pkgDir, `tests`),
    },
  }, {
    args: [ppath.dirname(pkgDir)],
    results: {
      CwdFS: ppath.dirname(pkgDir),
      JailFS: Error,
    },
  }, {
    args: [`tests`],
    results: {
      CwdFS: ppath.join(pkgDir, `tests`),
      JailFS: ppath.join(pkgDir, `tests`),
    },
  }, {
    args: [`../`],
    results: {
      CwdFS: ppath.dirname(pkgDir),
      JailFS: Error,
    },
  }, {
    args: [`../yarnpkg-fslib`],
    results: {
      CwdFS: pkgDir,
      JailFS: pkgDir,
    },
  }, {
    args: [`/`],
    results: {
      CwdFS: `/`,
      JailFS: Error,
    },
  }],
  readFileSync: [{
    args: [`/package.json`, `utf8`],
    results: {
      CwdFS: Error,
      JailFS: Error,
      SubFS: expect.stringContaining(`"name": "@yarnpkg/fslib"`),
    },
  }, {
    args: [`package.json`, `utf8`],
    results: {
      CwdFS: expect.stringContaining(`"name": "@yarnpkg/fslib"`),
      JailFS: expect.stringContaining(`"name": "@yarnpkg/fslib"`),
      SubFS: expect.stringContaining(`"name": "@yarnpkg/fslib"`),
    },
  }, {
    args: [`../../package.json`, `utf8`],
    results: {
      CwdFS: expect.stringContaining(`"name": "@yarnpkg/monorepo"`),
      JailFS: Error,
      SubFS: expect.stringContaining(`"name": "@yarnpkg/fslib"`),
    },
  }],
  realpathSync: [{
    args: [`package.json`],
    results: {
      SubFS: `/package.json`,
    },
  }],
};

describe(`FsLib comparison table`, () => {
  for (const [fnName, specs] of Object.entries(tests)) {
    for (const {args, results} of specs) {
      for (const [driveName, expectedResult] of Object.entries(results)) {
        test(`${fnName}(${args.join(`, `)}) => ${expectedResult} (${driveName})`, () => {
          const drive = new (drives as any)[driveName](pkgDir, {baseFs: nodeFs});

          if (expectedResult === Error) {
            expect(() => drive[fnName](...args)).toThrow();
          } else {
            expect(drive[fnName](...args)).toEqual(expectedResult);
          }
        });
      }
    }
  }
});
