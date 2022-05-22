import {Manifest, Report, Workspace, scriptUtils}                             from '@yarnpkg/core';
import {FakeFS, JailFS, xfs, PortablePath, ppath, Filename, npath, constants} from '@yarnpkg/fslib';
import {Hooks as StageHooks}                                                  from '@yarnpkg/plugin-stage';
import mm                                                                     from 'micromatch';
import tar                                                                    from 'tar-stream';
import {createGzip}                                                           from 'zlib';

import {Hooks}                                                                from './';

const NEVER_IGNORE = [
  `/package.json`,

  `/readme`,
  `/readme.*`,

  `/license`,
  `/license.*`,

  `/licence`,
  `/licence.*`,

  `/changelog`,
  `/changelog.*`,
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

export async function hasPackScripts(workspace: Workspace) {
  if (scriptUtils.hasWorkspaceScript(workspace, `prepack`))
    return true;

  if (scriptUtils.hasWorkspaceScript(workspace, `postpack`))
    return true;

  return false;
}

export async function prepareForPack(workspace: Workspace, {report}: {report: Report}, cb: () => Promise<void>) {
  await scriptUtils.maybeExecuteWorkspaceLifecycleScript(workspace, `prepack`, {report});

  try {
    const manifestPath = ppath.join(workspace.cwd, Manifest.fileName);
    if (await xfs.existsPromise(manifestPath))
      await workspace.manifest.loadFile(manifestPath, {baseFs: xfs});

    await cb();
  } finally {
    await scriptUtils.maybeExecuteWorkspaceLifecycleScript(workspace, `postpack`, {report});
  }
}

export async function genPackStream(workspace: Workspace, files?: Array<PortablePath>) {
  if (typeof files === `undefined`)
    files = await genPackList(workspace);

  const executableFiles = new Set<PortablePath>();
  for (const value of workspace.manifest.publishConfig?.executableFiles ?? new Set())
    executableFiles.add(ppath.normalize(value));
  for (const value of workspace.manifest.bin.values())
    executableFiles.add(ppath.normalize(value));

  const pack = tar.pack();

  process.nextTick(async () => {
    for (const fileRequest of files!) {
      const file = ppath.normalize(fileRequest);

      const source = ppath.resolve(workspace.cwd, file);
      const dest = ppath.join(`package` as PortablePath, file);

      const stat = await xfs.lstatPromise(source);

      const opts = {
        name: dest,
        mtime: new Date(constants.SAFE_TIME * 1000),
      };

      const mode = executableFiles.has(file)
        ? 0o755
        : 0o644;

      let resolveFn: Function;
      let rejectFn: Function;

      const awaitTarget = new Promise((resolve, reject) => {
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
        let content: Buffer;

        // The root package.json supports replacement fields in publishConfig
        if (file === `package.json`)
          content = Buffer.from(JSON.stringify(await genPackageManifest(workspace), null, 2));
        else
          content = await xfs.readFilePromise(source);

        pack.entry({...opts, mode, type: `file`}, content, cb);
      } else if (stat.isSymbolicLink()) {
        pack.entry({...opts, mode, type: `symlink`, linkname: await xfs.readlinkPromise(source)}, cb);
      } else {
        cb(new Error(`Unsupported file type ${stat.mode} for ${npath.fromPortablePath(file)}`));
      }

      await awaitTarget;
    }

    pack.finalize();
  });

  const tgz = createGzip();
  pack.pipe(tgz);

  return tgz;
}

export async function genPackageManifest(workspace: Workspace): Promise<object> {
  const data = JSON.parse(JSON.stringify(workspace.manifest.raw));

  await workspace.project.configuration.triggerHook(
    (hooks: Hooks) => hooks.beforeWorkspacePacking,
    workspace,
    data,
  );

  return data;
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

  const maybeRejectPath = (path: PortablePath | null) => {
    if (path === null || !path.startsWith(`${workspace.cwd}/`))
      return;

    const workspaceRelativePath = ppath.relative(workspace.cwd, path);
    const workspaceAbsolutePath = ppath.resolve(PortablePath.root, workspaceRelativePath);

    globalList.reject.push(workspaceAbsolutePath);
  };

  maybeRejectPath(ppath.resolve(project.cwd, configuration.get(`lockfileFilename`)));

  maybeRejectPath(configuration.get(`cacheFolder`));
  maybeRejectPath(configuration.get(`globalFolder`));
  maybeRejectPath(configuration.get(`installStatePath`));
  maybeRejectPath(configuration.get(`virtualFolder`));
  maybeRejectPath(configuration.get(`yarnPath`));

  await configuration.triggerHook((hooks: StageHooks) => {
    return hooks.populateYarnPaths;
  }, project, (path: PortablePath | null) => {
    maybeRejectPath(path);
  });

  // All child workspaces are ignored
  for (const otherWorkspace of project.workspaces) {
    const rel = ppath.relative(workspace.cwd, otherWorkspace.cwd);
    if (rel !== `` && !rel.match(/^(\.\.)?\//)) {
      globalList.reject.push(`/${rel}`);
    }
  }

  const ignoreList: IgnoreList = {
    accept: [],
    reject: [],
  };

  const main = workspace.manifest.publishConfig?.main ?? workspace.manifest.main;
  const module = workspace.manifest.publishConfig?.module ?? workspace.manifest.module;
  const browser = workspace.manifest.publishConfig?.browser ?? workspace.manifest.browser;
  const bins = workspace.manifest.publishConfig?.bin ?? workspace.manifest.bin;

  if (main != null)
    ignoreList.accept.push(ppath.resolve(PortablePath.root, main));
  if (module != null)
    ignoreList.accept.push(ppath.resolve(PortablePath.root, module));
  if (typeof browser === `string`)
    ignoreList.accept.push(ppath.resolve(PortablePath.root, browser));
  for (const path of bins.values())
    ignoreList.accept.push(ppath.resolve(PortablePath.root, path));

  if (browser instanceof Map) {
    for (const [original, replacement] of browser.entries()) {
      ignoreList.accept.push(ppath.resolve(PortablePath.root, original));
      if (typeof replacement === `string`) {
        ignoreList.accept.push(ppath.resolve(PortablePath.root, replacement));
      }
    }
  }

  const hasExplicitFileList = workspace.manifest.files !== null;
  if (hasExplicitFileList) {
    ignoreList.reject.push(`/*`);

    for (const pattern of workspace.manifest.files!) {
      addIgnorePattern(ignoreList.accept, pattern, {cwd: PortablePath.root});
    }
  }

  return await walk(workspace.cwd, {
    hasExplicitFileList,
    globalList,
    ignoreList,
  });
}

async function walk(initialCwd: PortablePath, {hasExplicitFileList, globalList, ignoreList}: {hasExplicitFileList: boolean, globalList: IgnoreList, ignoreList: IgnoreList}) {
  const list: Array<PortablePath> = [];

  const cwdFs = new JailFS(initialCwd);
  const cwdList: Array<[PortablePath, Array<IgnoreList>]> = [[PortablePath.root, [ignoreList]]];

  while (cwdList.length > 0) {
    const [cwd, ignoreLists] = cwdList.pop()!;
    const stat = await cwdFs.lstatPromise(cwd);

    if (isIgnored(cwd, {globalList, ignoreLists: stat.isDirectory() ? null : ignoreLists}))
      continue;

    if (stat.isDirectory()) {
      const entries = await cwdFs.readdirPromise(cwd);

      let hasGitIgnore = false;
      let hasNpmIgnore = false;

      if (!hasExplicitFileList || cwd !== PortablePath.root) {
        for (const entry of entries) {
          hasGitIgnore = hasGitIgnore || entry === `.gitignore`;
          hasNpmIgnore = hasNpmIgnore || entry === `.npmignore`;
        }
      }

      const localIgnoreList = hasNpmIgnore
        ? await loadIgnoreList(cwdFs, cwd, `.npmignore` as Filename)
        : hasGitIgnore
          ? await loadIgnoreList(cwdFs, cwd, `.gitignore` as Filename)
          : null;

      let nextIgnoreLists = localIgnoreList !== null
        ? [localIgnoreList].concat(ignoreLists)
        : ignoreLists;

      if (isIgnored(cwd, {globalList, ignoreLists}))
        nextIgnoreLists = [...ignoreLists, {accept: [], reject: [`**/*`]}];

      for (const entry of entries) {
        cwdList.push([ppath.resolve(cwd, entry), nextIgnoreLists]);
      }
    } else if (stat.isFile() || stat.isSymbolicLink()) {
      list.push(ppath.relative(PortablePath.root, cwd));
    }
  }

  return list.sort();
}

async function loadIgnoreList(fs: FakeFS<PortablePath>, cwd: PortablePath, filename: PortablePath) {
  const ignoreList: IgnoreList = {
    accept: [],
    reject: [],
  };

  const data = await fs.readFilePromise(ppath.join(cwd, filename), `utf8`);

  for (const pattern of data.split(/\n/g))
    addIgnorePattern(ignoreList.reject, pattern, {cwd});

  return ignoreList;
}

function normalizePattern(pattern: string, {cwd}: {cwd: PortablePath}) {
  const negated = pattern[0] === `!`;

  if (negated)
    pattern = pattern.slice(1);

  if (pattern.match(/\.{0,1}\//))
    pattern = ppath.resolve(cwd, pattern as PortablePath);

  if (negated)
    pattern = `!${pattern}`;

  return pattern;
}

function addIgnorePattern(target: Array<string>, pattern: string, {cwd}: {cwd: PortablePath}) {
  const trimed = pattern.trim();

  if (trimed === `` || trimed[0] === `#`)
    return;

  target.push(normalizePattern(trimed, {cwd}));
}

enum MatchType {
  None,
  Match,
  NegatedMatch,
}

function isIgnored(cwd: string, {globalList, ignoreLists}: {globalList: IgnoreList, ignoreLists: Array<IgnoreList> | null}) {
  const globalAcceptMatchType = matchPatternType(cwd, globalList.accept);
  if (globalAcceptMatchType !== MatchType.None)
    return globalAcceptMatchType === MatchType.NegatedMatch;

  const globalRejectMatchType = matchPatternType(cwd, globalList.reject);
  if (globalRejectMatchType !== MatchType.None)
    return globalRejectMatchType === MatchType.Match;

  if (ignoreLists !== null) {
    for (const ignoreList of ignoreLists) {
      const acceptMatchType = matchPatternType(cwd, ignoreList.accept);
      if (acceptMatchType !== MatchType.None)
        return acceptMatchType === MatchType.NegatedMatch;

      const rejectMatchType = matchPatternType(cwd, ignoreList.reject);
      if (rejectMatchType !== MatchType.None) {
        return rejectMatchType === MatchType.Match;
      }
    }
  }

  return false;
}

function matchPatternType(path: string, patterns: Array<string>) {
  let inclusives = patterns;
  const exclusives = [];

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
    return MatchType.NegatedMatch;
  if (isMatchBasename(path, inclusives))
    return MatchType.Match;

  return MatchType.None;
}

function isMatchBasename(path: string, patterns: Array<string>) {
  let paths = patterns;
  const basenames = [];

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

  if (mm.isMatch(path, paths as any, {dot: true, nocase: true}))
    return true;
  if (mm.isMatch(path, basenames as any, {dot: true, basename: true, nocase: true}))
    return true;

  return false;
}
