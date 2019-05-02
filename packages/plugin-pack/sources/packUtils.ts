import {Workspace}           from '@berry/core';
import {FakeFS, JailFS, xfs} from '@berry/fslib';
import mm                    from 'micromatch';
import {posix}               from 'path';
import tar                   from 'tar-stream';

import {Hooks}               from './';

export async function genPackStream(workspace: Workspace, files?: Array<string>) {
  if (typeof files === `undefined`)
    files = await genPackList(workspace);

  const pack = tar.pack();

  for (const file of files) {
    const source = posix.resolve(workspace.cwd, file);
    const dest = posix.join(`package`, file);

    const stat = await xfs.lstatPromise(source);
    const opts = {name: dest, mtime: new Date(315532800)};

    if (stat.isFile()) {
      pack.entry(opts, await xfs.readFilePromise(source));
    } else if (stat.isSymbolicLink()) {
      pack.entry({... opts, linkname: await xfs.readlinkPromise(source)});
    }
  }

  pack.finalize();

  return pack;
}

export async function genPackList(workspace: Workspace) {
  const project = workspace.project;
  const configuration = project.configuration;

  const forceReject: Array<string> = [
    `/package.tgz`,

    `node_modules`,

    `.npmignore`,
    `.gitignore`,

    `.#*`,
    `.DS_Store`,

    configuration.get(`rcFilename`),
  ];

  const forceAccept: Array<string> = [
    `/package.json`,

    `/readme`,
    `/readme.*`,

    `/license`,
    `/license.*`,

    `/licence`,
    `/licence.*`,
  ];

  const maybeRejectPath = (path: string | null) => {
    if (path === null || !path.startsWith(`${workspace.cwd}/`))
      return;

    const workspaceRelativePath = posix.relative(workspace.cwd, path);
    const workspaceAbsolutePath = posix.resolve(`/`, workspaceRelativePath);

    forceReject.push(workspaceAbsolutePath);
  };

  maybeRejectPath(posix.resolve(project.cwd, configuration.get(`lockfileFilename`)));
  maybeRejectPath(posix.resolve(project.cwd, `.git`));
  maybeRejectPath(configuration.get(`bstatePath`));
  maybeRejectPath(configuration.get(`cacheFolder`));
  maybeRejectPath(configuration.get(`globalFolder`));
  maybeRejectPath(configuration.get(`virtualFolder`));
  maybeRejectPath(configuration.get(`yarnPath`));

  await configuration.triggerHook((hooks: Hooks) => {
    return hooks.populateYarnPaths;
  }, project, (path: string | null) => {
    maybeRejectPath(path);
  });

  return await walk(workspace.cwd, {
    forceAccept,
    forceReject,
  });
}

async function walk(initialCwd: string, {forceAccept, forceReject}: {forceAccept: Array<string>, forceReject: Array<string>}) {
  const list = [];

  const cwdFs = new JailFS(initialCwd);
  const cwdList: Array<[string, Array<string>]> = [[`/`, []]];

  while (cwdList.length > 0) {
    const [cwd, ignoreList] = cwdList.pop()!;

    if (isIgnored(cwd, ignoreList, {forceAccept, forceReject}))
      continue;

    const stat = await cwdFs.lstatPromise(cwd);

    if (stat.isDirectory()) {
      const entries = await cwdFs.readdirPromise(cwd);

      let hasGitIgnore = false;
      let hasNpmIgnore = false;

      for (const entry of entries) {
        hasGitIgnore = hasGitIgnore || entry === `.gitignore`;
        hasNpmIgnore = hasNpmIgnore || entry === `.npmignore`;
      }

      const localIgnoreList = hasNpmIgnore
        ? await loadIgnoreList(cwdFs, cwd, `.npmignore`)
        : hasGitIgnore
          ? await loadIgnoreList(cwdFs, cwd, `.gitignore`)
          : null;

      const nextIgnoreList = localIgnoreList !== null
        ? ignoreList.concat(localIgnoreList)
        : ignoreList;

      for (const entry of entries) {
        cwdList.push([posix.resolve(cwd, entry), nextIgnoreList]);
      }
    } else {
      list.push(posix.relative(`/`, cwd));
    }
  }

  return list.sort();
}

async function loadIgnoreList(fs: FakeFS, cwd: string, filename: string) {
  const data = await fs.readFilePromise(`${cwd}/${filename}`, `utf8`);

  return data.split(/\n/g).map(line => {
    if (line.startsWith(`../`) || line.trim().length === 0) {
      return null;
    } else if (line.match(/\.{0,1}\//)) {
      return posix.resolve(cwd, line);
    } else {
      return line;
    }
  }).filter(entry => {
    return entry !== null;
  }) as Array<string>;
}

function isIgnored(cwd: string, ignoreList: Array<string>, {forceAccept, forceReject}: {forceAccept: Array<string>, forceReject: Array<string>}) {
  const opts = {basename: true};

  if (mm.some([cwd], forceAccept, opts))
    return false;
  
  if (mm.some([cwd], forceReject, opts))
    return true;

  return mm.some([cwd], ignoreList, opts);
}
