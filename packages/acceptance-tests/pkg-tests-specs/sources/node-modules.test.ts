import {npath} from '@yarnpkg/fslib';
import {fs}    from 'pkg-tests-core';

const {writeFile} = fs;

describe('Node_Modules', () => {
  it('should install one dependency',
    makeTemporaryEnv(
      {
        dependencies: {[`repeat-string`]: `1.6.1`},
      },
      async ({path, run, source}) => {
        await writeFile(npath.toPortablePath(`${path}/.yarnrc.yml`), `nodeLinker: "node-modules"\n`);

        // await expect(run(`install`)).resolves.toBe('abc');
      },
    ),
  );
});
