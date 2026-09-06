import {execUtils}      from '@yarnpkg/core';
import {npath, NodeFS}  from '@yarnpkg/fslib';

import {diffFolders}    from '../sources/patchUtils';
import {parsePatchFile} from '../sources/tools/parse';

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

  it(`ignores git warnings on stderr`, async () => {
    const spy = jest.spyOn(execUtils, `execvp`).mockResolvedValue({
      code: 1,
      stdout: `diff --git a/file.txt b/file.txt\n`,
      stderr: `warning: unable to access '/.config/git/attributes': Permission denied\n`,
    } as any);

    try {
      const diff = await diffFolders(
        npath.toPortablePath(npath.join(fixtures, `update`, `a`)),
        npath.toPortablePath(npath.join(fixtures, `update`, `b`)),
      );
      expect(diff).toContain(`diff --git`);
    } finally {
      spy.mockRestore();
    }
  });
});
