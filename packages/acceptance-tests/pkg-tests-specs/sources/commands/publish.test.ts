import {npath}  from '@yarnpkg/fslib';
import {NodeFS} from '@yarnpkg/fslib';
import {fs}     from 'pkg-tests-core';

async function createWithGitRepo (testdir) {
  await fs.writeFile(`${testdir}/.git/HEAD`,
    `ref: refs/heads/master\n`
  );
  await fs.writeFile(`${testdir}/.git/config`,
    `[core]\n` +
    `\trepositoryformatversion = 0\n` +
    `\tfilemode = false\n` +
    `\tbare = false\n` +
    `\tlogallrefupdates = true\n` +
    `\tignorecase = true\n`
  );
  await fs.writeFile(`${testdir}/.git/index`, Buffer.from(
    `4449524300000002000000016123da042e2461fa6123da042e2461fa0000` +
    `08300010791b000081a4000003e8000003e8000000396cb46ff2111f70eb` +
    `2bf855e0892d5acc34b341e0000c7061636b6167652e6a736f6e00000000` +
    `00005452454500000019003120300a90b5d93aed1d699fd521fe41c63064` +
    `654e61323395a92e6c6105191c46e45badfad1746b1d8afa8b`,
    `hex`
  ));
  await fs.writeFile(`${testdir}/.git/objects/90/b5d93aed1d699fd521fe41c63064654e613233`, Buffer.from(
    `78012b294a4d553031603034303033315128484cce4e4c4fd5cb2acecf63` +
    `c8d992ff4950bee0b5f68fd0079dba51674c363b3e0000811c1280`,
    `hex`
  ));

  await fs.writeFile(`${testdir}/.git/objects/3d/fb9155e63f7ad05437f789bd10ef4e75ffb4f7`, Buffer.from(
    `78019d8ddb0d02211000fda68a6dc00bcf551263bc1e6c60854551392e77` +
    `d0bfd4e0df6492c9845a4a6ea0cefed03666f0f2e1a237c45145f43e45a7` +
    `5562ab021a89169d6554461b23a8b757dd605efa4a85e0debf192eb4f436` +
    `e05672d8ea5e539b422d5750a847ee354a38ca939462d8716dfc6f2fe618` +
    `61a5f0a1274fefbd2ee20736233de5`,
    `hex`
  ));

  await fs.writeFile(`${testdir}/.git/objects/6c/b46ff2111f70eb2bf855e0892d5acc34b341e0`, Buffer.from(
    `78014bcac94f52303567a8e6e5520002a5bcc4dc54252b05a592d4e212dd` +
    `82c4e4ecc4f454251da864596a5171667e1e48de50cf40cf408997ab1600` +
    `358310a6`,
    `hex`
  ));

  await fs.writeFile(`${testdir}/.git/refs/heads/master`,
    `3dfb9155e63f7ad05437f789bd10ef4e75ffb4f7\n`
  );

  await fs.writeFile(`${testdir}/.yarnrc.yml`,
    `npmAuthIdent: "username:a very secure password"`
  );

  await fs.writeFile(`${testdir}/package.json`, JSON.stringify({
    name: `requires-githead`,
    version: `1.0.0`,
  }));
}

async function createWithoutGitRepo (testdir) {
  await fs.writeFile(`${testdir}/.yarnrc.yml`,
    `npmAuthIdent: "username:a very secure password"`
  );
  await fs.writeFile(`${testdir}/package.json`, JSON.stringify({
    name: `not-requires-githead`,
    version: `1.0.0`,
  }));
}


describe(`npmPublishUtils.getGitHead`, () =>   {
  test(
    `it should detect the gitHead for this repo`,
    makeTemporaryEnv({}, async ({path, run, source}) => {
      let code;
      let stdout;
      let stderr;

      const portableTestDir = await fs.createTemporaryFolder();
      const testDir = npath.fromPortablePath(portableTestDir);
      await createWithGitRepo(portableTestDir);
      try {
        ({code, stdout, stderr} = await run(`install`, {
          env: {
            HOME: `${testDir}`,
            USERPROFILE: `${testDir}`,
          },
          cwd: `${portableTestDir}`,
        }));

        ({code, stdout, stderr} = await run(`npm`, `publish`, {
          env: {
            HOME: `${testDir}`,
            USERPROFILE: `${testDir}`,
          },
          cwd: `${portableTestDir}`,
        }));
      } catch (error) {
        ({code, stdout, stderr} = error);
      }

      expect({code, stdout, stderr}).toMatchSnapshot();
      expect(code).toBe(0);
      const nodefs = new NodeFS();
      nodefs.rmdirSync(portableTestDir, {recursive: true, force: true});
    }));

  test(
    `it should not detect the gitHead for this repo`,
    makeTemporaryEnv({}, async ({path, run, source}) => {
      let code;
      let stdout;
      let stderr;

      const portableTestDir = await fs.createTemporaryFolder();
      const testDir = npath.fromPortablePath(portableTestDir);
      await createWithoutGitRepo(portableTestDir);
      try {
        ({code, stdout, stderr} = await run(`install`, {
          env: {
            HOME: `${testDir}`,
            USERPROFILE: `${testDir}`,
          },
          cwd: `${portableTestDir}`,
        }));

        ({code, stdout, stderr} = await run(`npm`, `publish`, {
          env: {
            HOME: `${testDir}`,
            USERPROFILE: `${testDir}`,
          },
          cwd: `${portableTestDir}`,
        }));
      } catch (error) {
        ({code, stdout, stderr} = error);
      }

      expect({code, stdout, stderr}).toMatchSnapshot();
      expect(code).toBe(0);
      const nodefs = new NodeFS();
      nodefs.rmdirSync(portableTestDir, {recursive: true, force: true});
    }));
});
