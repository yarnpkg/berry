import {MessageName, Report, Workspace, scriptUtils} from '@berry/core';
import {FakeFS, JailFS, xfs}                         from '@berry/fslib';
import mm                                            from 'micromatch';
import {posix}                                       from 'path';
import {PassThrough}                                 from 'stream';
import tar                                           from 'tar-stream';
import {createGzip}                                  from 'zlib';

import {Hooks}                                       from './';

const NEVER_IGNORE = [
  `/package.json`,

  `/readme`,
  `/readme.*`,

  `/license`,
  `/license.*`,

  `/licence`,
  `/licence.*`,
];

const ALWAYS_IGNORE = [
  `/package.tgz`,

  `.github`,
  `.git`,
  `.hg`,
  `node_modules`,

  `.npmignore`,
  `.gitignore`,

  `.#*`,
  `.DS_Store`,
];

type IgnoreList = {
  accept: Array<string>;
  reject: Array<string>;
};

export async function prepareForPack(workspace: Workspace, {report}: {report: Report}, cb: () => Promise<void>) {
  const stdin = null;
  const stdout = new PassThrough();
  const stderr = new PassThrough();

  if (await scriptUtils.hasWorkspaceScript(workspace, `prepack`)) {
    report.reportInfo(MessageName.LIFECYCLE_SCRIPT, `Calling the "prepack" lifecycle script`);
    await scriptUtils.executeWorkspaceScript(workspace, `prepack`, [], {stdin, stdout, stderr});
  }

  try {
    await cb();
  } finally {
    if (await scriptUtils.hasWorkspaceScript(workspace, `postpack`)) {
      report.reportInfo(MessageName.LIFECYCLE_SCRIPT, `Calling the "postpack" lifecycle script`);
      await scriptUtils.executeWorkspaceScript(workspace, `postpack`, [], {stdin, stdout, stderr});
    }
  }
}

export async function genPackStream(workspace: Workspace, files?: Array<string>) {
  if (typeof files === `undefined`)
    files = await genPackList(workspace);

  const pack = tar.pack();

  process.nextTick(async () => {
    for (const file of files!) {
      const source = posix.resolve(workspace.cwd, file);
      const dest = posix.join(`package`, file);

      const stat = await xfs.lstatPromise(source);
      const opts = {name: dest, mtime: new Date(315532800)};

      let resolveFn: Function;
      let rejectFn: Function;

      let awaitTarget = new Promise((resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
      });

      const cb = (error: any) => {
        if (error) {
          rejectFn(error);
        } else {
          resolveFn();
        }
      };

      if (stat.isFile()) {
        let content = await xfs.readFilePromise(source);

        // The root package.json supports replacement fields in publishConfig
        if (file === `package.json`) {
          const data = JSON.parse(content.toString());

          if (data.publishConfig) {
            if (data.publishConfig.main)
              data.main = data.publishConfig.main;
            
            if (data.publishConfig.module) {
              data.module = data.publishConfig.module;
            }
          }

          content = Buffer.from(JSON.stringify(data, null, 2));
        }

        pack.entry({... opts, type: `file`}, content, cb);
      } else if (stat.isSymbolicLink()) {
        pack.entry({... opts, type: `symlink`, linkname: await xfs.readlinkPromise(source)}, cb);
      }

      await awaitTarget;
    }

    pack.finalize();
  });

  const tgz = createGzip();
  pack.pipe(tgz);

  return tgz;
}

export async function genPackList(workspace: Workspace) {
  const project = workspace.project;
  const configuration = project.configuration;

  const globalList: IgnoreList = {
    accept: [],
    reject: [],
  };

  for (const pattern of ALWAYS_IGNORE)
    globalList.reject.push(pattern);

  for (const pattern of NEVER_IGNORE)
    globalList.accept.push(pattern);

  globalList.reject.push(configuration.get(`rcFilename`));

  const maybeRejectPath = (path: string | null) => {
    if (path === null || !path.startsWith(`${workspace.cwd}/`))
      return;

    const workspaceRelativePath = posix.relative(workspace.cwd, path);
    const workspaceAbsolutePath = posix.resolve(`/`, workspaceRelativePath);

    globalList.reject.push(workspaceAbsolutePath);
  };

  maybeRejectPath(posix.resolve(project.cwd, configuration.get(`lockfileFilename`)));

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

  // All child workspaces are ignored
  for (const otherWorkspace of project.workspaces) {
    const rel = posix.relative(workspace.cwd, otherWorkspace.cwd);
    if (rel !== `` && !rel.match(/^(\.\.)?\//)) {
      globalList.reject.push(`/${rel}`);
    }
  }

  const ignoreList: IgnoreList = {
    accept: [],
    reject: [],
  };

  if (workspace.manifest.publishConfig && workspace.manifest.publishConfig.main)
    ignoreList.accept.push(posix.resolve(`/`, workspace.manifest.publishConfig.main));
  else if (workspace.manifest.main)
    ignoreList.accept.push(posix.resolve(`/`, workspace.manifest.main));

  if (workspace.manifest.publishConfig && workspace.manifest.publishConfig.module)
    ignoreList.accept.push(posix.resolve(`/`, workspace.manifest.publishConfig.module));
  else if (workspace.manifest.module)
    ignoreList.accept.push(posix.resolve(`/`, workspace.manifest.module));

  if (workspace.manifest.files !== null) {
    ignoreList.reject.push(`*`);

    for (const pattern of workspace.manifest.files) {
      addIgnorePattern(ignoreList.accept, pattern, {cwd: `/`});
    }
  }

  return await walk(workspace.cwd, {
    globalList,
    ignoreList,
  });
}

async function walk(initialCwd: string, {globalList, ignoreList}: {globalList: IgnoreList, ignoreList: IgnoreList}) {
  const list = [];

  const cwdFs = new JailFS(initialCwd);
  const cwdList: Array<[string, Array<IgnoreList>]> = [[`/`, [ignoreList]]];

  while (cwdList.length > 0) {
    const [cwd, ignoreLists] = cwdList.pop()!;
    const stat = await cwdFs.lstatPromise(cwd);

    if (isIgnored(cwd, {globalList, ignoreLists: stat.isDirectory() ? null : ignoreLists}))
      continue;

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

      const nextIgnoreLists = localIgnoreList !== null
        ? [localIgnoreList].concat(ignoreLists)
        : ignoreLists;

      for (const entry of entries) {
        cwdList.push([posix.resolve(cwd, entry), nextIgnoreLists]);
      }
    } else {
      list.push(posix.relative(`/`, cwd));
    }
  }

  return list.sort();
}

async function loadIgnoreList(fs: FakeFS, cwd: string, filename: string) {
  const ignoreList: IgnoreList = {
    accept: [],
    reject: [],
  };

  const data = await fs.readFilePromise(`${cwd}/${filename}`, `utf8`);

  for (const pattern of data.split(/\n/g))
    addIgnorePattern(ignoreList.reject, pattern, {cwd});

  return ignoreList;
}

function normalizePattern(pattern: string, {cwd}: {cwd: string}) {
  const negated = pattern[0] === `!`;

  if (negated)
    pattern = pattern.slice(1);

  if (pattern.match(/\.{0,1}\//))
    pattern = posix.resolve(cwd, pattern);

  if (negated)
    pattern = `!${pattern}`;

  return pattern;
};

function addIgnorePattern(target: Array<string>, pattern: string, {cwd}: {cwd: string}) {
  let trimed = pattern.trim();

  if (trimed === `` || trimed[0] === `#`)
    return;

  target.push(normalizePattern(trimed, {cwd}));
}

function isIgnored(cwd: string, {globalList, ignoreLists}: {globalList: IgnoreList, ignoreLists: Array<IgnoreList> | null}) {
  if (isMatch(cwd, globalList.accept))
    return false;
  if (isMatch(cwd, globalList.reject))
    return true;

  if (ignoreLists !== null) {
    for (const ignoreList of ignoreLists) {
      if (isMatch(cwd, ignoreList.accept))
        return false;

      if (isMatch(cwd, ignoreList.reject)) {
        return true;
      }
    }
  }

  return false;
}

function isMatch(path: string, patterns: Array<string>) {
  let inclusives = patterns;
  let exclusives = [];

  for (let t = 0; t < patterns.length; ++t) {
    if (patterns[t][0] !== `!`) {
      if (inclusives !== patterns) {
        inclusives.push(patterns[t]);
      }
    } else {
      if (inclusives === patterns)
        inclusives = patterns.slice(0, t);

      exclusives.push(patterns[t].slice(1));
    }
  }

  if (isMatchBasename(path, exclusives))
    return false;
  if (isMatchBasename(path, inclusives))
    return true;

  return false;
}

function isMatchBasename(path: string, patterns: Array<string>) {
  let paths = patterns;
  let basenames = [];

  for (let t = 0; t < patterns.length; ++t) {
    if (patterns[t].includes(`/`)) {
      if (paths !== patterns) {
        paths.push(patterns[t]);
      }
    } else {
      if (paths === patterns)
        paths = patterns.slice(0, t);

      basenames.push(patterns[t]);
    }
  }

  if (mm.isMatch(path, paths as any, {dot: true}))
    return true;
  if (mm.isMatch(path, basenames as any, {dot: true, basename: true}))
    return true;

  return false;
}
