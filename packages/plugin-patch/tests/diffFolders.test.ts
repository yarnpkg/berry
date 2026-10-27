import {npath, NodeFS}                from '@yarnpkg/fslib';

import {diffFolders, gitStderrErrors} from '../sources/patchUtils';
import {parsePatchFile}               from '../sources/tools/parse';

describe(`diffFolders`,  () => {
  const fs = new NodeFS();
  const fixtures = npath.join(__dirname, `fixtures`);

  for (const iterator of fs.readdirSync(npath.toPortablePath(fixtures))) {
    it(`Makes and parses diff for '${iterator}'`, async () => {
      const diff = await diffFolders(
        npath.toPortablePath(npath.join(fixtures, iterator, `a`)),
        npath.toPortablePath(npath.join(fixtures, iterator, `b`)),
      );

      expect(diff).toMatchSnapshot();
      expect(parsePatchFile(diff)).toMatchSnapshot();
    });
  }

  it(`ignores git warnings on stderr`, () => {
    expect(gitStderrErrors(`warning: unable to access '/.config/git/attributes': Permission denied\n`)).toEqual(``);
    expect(gitStderrErrors(`warning: foo\nfatal: not a git repository\n`)).toEqual(`fatal: not a git repository`);
  });
});
