import {npath,NodeFS}   from '@yarnpkg/fslib';

import {diffFolders}    from '../sources/patchUtils';
import {parsePatchFile} from '../sources/tools/parse';

describe(`diffFolders`,  () => {
  const fs = new NodeFS();
  const fixtures = npath.join(__dirname,`fixtures`);

  for (const iterator of fs.readdirSync(npath.toPortablePath(fixtures))) {
    it(`Makes and parses diff for '${iterator}'`, async () => {
      const diff = await diffFolders(
        npath.toPortablePath(npath.join(fixtures, iterator, `a`)),
        npath.toPortablePath(npath.join(fixtures, iterator, `b`))
      );

      expect(diff).toMatchSnapshot();
      expect(parsePatchFile(diff)).toMatchSnapshot();
    });
  }
});
