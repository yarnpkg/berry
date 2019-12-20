import {npath} from '@yarnpkg/fslib';
import {fs}    from 'pkg-tests-core';

const {writeFile} = fs;

describe('Node_Modules', () => {
  it('should install one dependency',
    makeTemporaryEnv(
      {
        dependencies: {
          [`resolve`]: `1.9.0`,
        },
      },
      async ({path, run, source}) => {
        await writeFile(npath.toPortablePath(`${path}/.yarnrc.yml`), `nodeLinker: "node-modules"\n`);

        await run(`install`);

        await expect(source(`require('resolve').sync('resolve')`)).resolves.toEqual(
          await source(`require.resolve('resolve')`),
        );
      },
    )
  );
});
