import {Workspace, Project} from '@yarnpkg/core';
import {npath}              from '@yarnpkg/fslib';
import {makePublishBody}    from '@yarnpkg/plugin-npm/sources/npmPublishUtils';
import Tacks                from 'tacks';

import {makeConfiguration}  from './_makeConfiguration';

const File = Tacks.File;
const Dir = Tacks.Dir;
const fixtures = new Tacks(
  Dir({
    WithGitRepo: Dir({
      ".git": Dir({
        config: File(
          `[core]\n` +
          `\trepositoryformatversion = 0\n` +
          `\tfilemode = false\n` +
          `\tbare = false\n` +
          `\tlogallrefupdates = true\n` +
          `\tignorecase = true\n`
        ),
        HEAD: File(
          `ref: refs/heads/master\n`
        ),
        index: File(new Buffer(
          `44495243000000020000000160ef748e33a626b460ef74dc16371cc80000` +
          `000000000000000081a40000000000000000000000396cb46ff2111f70eb` +
          `2bf855e0892d5acc34b341e0000c7061636b6167652e6a736f6e00000000` +
          `00005452454500000019003120300a90b5d93aed1d699fd521fe41c63064` +
          `654e613233c5e85f675813e97501a60d11d8e161edef086d09`,
          `hex`
        )),
        info: Dir({
          exclude: File(
            ``
          ),
        }),
        logs: Dir({
          HEAD: File(
            `0000000000000000000000000000000000000000 3dfb9155e63f7ad05437f789bd10ef4e75ffb4f7 Anupama Tuli <anutuli@microsoft.com> 1626309260 -0700\tcommit (initial): Add package.json\n`
          ),
          refs: Dir({
            heads: Dir({
              master: File(
                `0000000000000000000000000000000000000000 3dfb9155e63f7ad05437f789bd10ef4e75ffb4f7 Anupama Tuli <anutuli@microsoft.com> 1626309260 -0700\tcommit (initial): Add package.json\n`
              ),
            }),
          }),
        }),
        objects: Dir({
          90: Dir({
            b5d93aed1d699fd521fe41c63064654e613233: File(new Buffer(
              `78012b294a4d553031603034303033315128484cce4e4c4fd5cb2acecf63` +
              `c8d992ff4950bee0b5f68fd0079dba51674c363b3e0000811c1280`,
              `hex`
            )),
          }),
          '3d': Dir({
            fb9155e63f7ad05437f789bd10ef4e75ffb4f7: File(new Buffer(
              `78019d8ddb0d02211000fda68a6dc00bcf551263bc1e6c60854551392e77` +
              `d0bfd4e0df6492c9845a4a6ea0cefed03666f0f2e1a237c45145f43e45a7` +
              `5562ab021a89169d6554461b23a8b757dd605efa4a85e0debf192eb4f436` +
              `e05672d8ea5e539b422d5750a847ee354a38ca939462d8716dfc6f2fe618` +
              `61a5f0a1274fefbd2ee20736233de5`,
              `hex`
            )),
          }),
          '6c': Dir({
            b46ff2111f70eb2bf855e0892d5acc34b341e0: File(new Buffer(
              `78014bcac94f52303567a8e6e5520002a5bcc4dc54252b05a592d4e212dd` +
              `82c4e4ecc4f454251da864596a5171667e1e48de50cf40cf408997ab1600` +
              `358310a6`,
              `hex`
            )),
          }),
          info: Dir({
          }),
          pack: Dir({
          }),
        }),
        refs: Dir({
          heads: Dir({
            master: File(
              `3dfb9155e63f7ad05437f789bd10ef4e75ffb4f7\n`
            ),
          }),
          tags: Dir({
          }),
        }),
      }),
      'package.json': File({
        name: `test-package`,
        version: `1.0.0`,
      }),
    }),
    WithoutGitRepo: Dir({
      'package.json': File({
        name: `test-package`,
        version: `1.0.0`,
      }),
    }),
  })
);

const testDir = `${__dirname}/../../../../yarnTempTest`;
beforeAll(() => {
  fixtures.create(testDir);
});
afterAll(() => {
  fixtures.remove(testDir);
});

describe(`npmPublishUtils.makePublishBody`, () =>   {
  it(`should detect the gitHead for this repo`, async () => {
    const configuration = await makeConfiguration();

    const workspaceCwd = npath.toPortablePath(`${testDir}/WithGitRepo`);

    const project = new Project(workspaceCwd, {configuration});
    const workspace = new Workspace(workspaceCwd, {project});
    await workspace.setup();
    const fly = {access: `public`, tag: `latest`, registry: configuration.get(`npmRegistryServer`)};
    const publishBody = await makePublishBody(workspace, Buffer.from(``), fly);
    expect(publishBody.gitHead).not.toEqual(null);
  });

  it(`should not detect the gitHead for this repo`, async () => {
    const configuration = await makeConfiguration();

    const workspaceCwd = npath.toPortablePath(`${testDir}/WithoutGitRepo`);

    const project = new Project(workspaceCwd, {configuration});
    const workspace = new Workspace(workspaceCwd, {project});
    await workspace.setup();
    const fly = {access: `public`, tag: `latest`, registry: configuration.get(`npmRegistryServer`)};
    const publishBody = await makePublishBody(workspace, Buffer.from(``), fly);
    expect(publishBody.gitHead).toEqual(null);
  });
});
