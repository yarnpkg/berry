import {Configuration, Hooks, Locator, Project, execUtils, httpUtils, miscUtils, semverUtils, structUtils, ReportError, MessageName, formatUtils} from '@yarnpkg/core';
import {Filename, npath, PortablePath, ppath, xfs}                                                                                                from '@yarnpkg/fslib';
import {UsageError}                                                                                                                               from 'clipanion';
import GitUrlParse                                                                                                                                from 'git-url-parse';
import capitalize                                                                                                                                 from 'lodash/capitalize';
import querystring                                                                                                                                from 'querystring';
import semver                                                                                                                                     from 'semver';
import urlLib                                                                                                                                     from 'url';

function makeGitEnvironment() {
  return {
    ...process.env,
    // An option passed to SSH by Git to prevent SSH from asking for data (which would cause installs to hang when the SSH keys are missing)
    GIT_SSH_COMMAND: `ssh -o BatchMode=yes`,
  };
}

const gitPatterns = [
  /^ssh:/,
  /^git(?:\+[^:]+)?:/,

  // `git+` is optional, `.git` is required
  /^(?:git\+)?https?:[^#]+\/[^#]+(?:\.git)(?:#.*)?$/,

  /^git@[^#]+\/[^#]+\.git(?:#.*)?$/,

  /^(?:github:|https:\/\/github\.com\/)?(?!\.{1,2}\/)([a-zA-Z._0-9-]+)\/(?!\.{1,2}(?:#|$))([a-zA-Z._0-9-]+?)(?:\.git)?(?:#.*)?$/,
  // GitHub `/tarball/` URLs
  /^https:\/\/github\.com\/(?!\.{1,2}\/)([a-zA-Z0-9._-]+)\/(?!\.{1,2}(?:#|$))([a-zA-Z0-9._-]+?)\/tarball\/(.+)?$/,
];

export enum TreeishProtocols {
  Commit = `commit`,
  Head = `head`,
  Tag = `tag`,
  Semver = `semver`,
}

/**
 * Determines whether a given url is a valid github git url via regex
 */
export function isGitUrl(url: string): boolean {
  return url ? gitPatterns.some(pattern => !!url.match(pattern)) : false;
}

export type RepoUrlParts = {
  repo: string;
  treeish: {
    protocol: TreeishProtocols | string | null;
    request: string;
  };
  extra: {
    [key: string]: string;
  };
};

export function splitRepoUrl(url: string): RepoUrlParts {
  url = normalizeRepoUrl(url);

  const hashIndex = url.indexOf(`#`);
  if (hashIndex === -1) {
    return {
      repo: url,
      treeish: {
        protocol: TreeishProtocols.Head,
        request: `HEAD`,
      },
      extra: {},
    };
  }

  const repo = url.slice(0, hashIndex);
  const subsequent = url.slice(hashIndex + 1);

  // New-style: "#commit=abcdef&workspace=foobar"
  if (subsequent.match(/^[a-z]+=/)) {
    const extra = querystring.parse(subsequent);

    for (const [key, value] of Object.entries(extra))
      if (typeof value !== `string`)
        throw new Error(`Assertion failed: The ${key} parameter must be a literal string`);

    const requestedProtocol = Object.values(TreeishProtocols).find(protocol => {
      return Object.prototype.hasOwnProperty.call(extra, protocol);
    });

    let protocol: TreeishProtocols;
    let request: string;

    if (typeof requestedProtocol !== `undefined`) {
      protocol = requestedProtocol;
      request = extra[requestedProtocol]! as string;
    } else {
      protocol = TreeishProtocols.Head;
      request = `HEAD`;
    }

    for (const key of Object.values(TreeishProtocols))
      delete extra[key];

    return {
      repo,
      treeish: {protocol, request},
      extra: extra as {
        [key: string]: string;
      },
    };
  } else {
    // Old-style: "#commit:abcdef" or "#abcdef"
    const colonIndex = subsequent.indexOf(`:`);

    let protocol: string | null;
    let request: string;

    if (colonIndex === -1) {
      protocol = null;
      request = subsequent;
    } else {
      protocol = subsequent.slice(0, colonIndex);
      request = subsequent.slice(colonIndex + 1);
    }

    return {
      repo,
      treeish: {protocol, request},
      extra: {},
    };
  }
}

export function normalizeRepoUrl(url: string, {git = false}: {git?: boolean} = {}) {
  // "git+https://" isn't an actual Git protocol. It's just a way to
  // disambiguate that this URL points to a Git repository.
  url = url.replace(/^git\+https:/, `https:`);

  // We support this as an alias to GitHub repositories
  url = url.replace(/^(?:github:|https:\/\/github\.com\/)?(?!\.{1,2}\/)([a-zA-Z0-9._-]+)\/(?!\.{1,2}(?:#|$))([a-zA-Z0-9._-]+?)(?:\.git)?(#.*)?$/, `https://github.com/$1/$2.git$3`);

  // We support GitHub `/tarball/` URLs
  url = url.replace(/^https:\/\/github\.com\/(?!\.{1,2}\/)([a-zA-Z0-9._-]+)\/(?!\.{1,2}(?:#|$))([a-zA-Z0-9._-]+?)\/tarball\/(.+)?$/, `https://github.com/$1/$2.git#$3`);

  if (git) {
    // The `git+` prefix doesn't mean anything at all for Git
    url = url.replace(/^git\+([^:]+):/, `$1:`);

    // The `ssh://` prefix should be removed because so URLs won't work in Git:
    //   ssh://git@github.com:yarnpkg/berry.git
    //   git@github.com/yarnpkg/berry.git
    // Git only allows:
    //   git@github.com:yarnpkg/berry.git (no ssh)
    //   ssh://git@github.com/yarnpkg/berry.git (no colon)
    // So we should cut `ssh://`, but only in URLs that contain colon after the hostname

    let parsedUrl: urlLib.UrlWithStringQuery | null;
    try {
      parsedUrl = urlLib.parse(url);
    } catch {
      parsedUrl = null;
    }

    if (parsedUrl && parsedUrl.protocol === `ssh:` && parsedUrl.path?.startsWith(`/:`)) {
      url = url.replace(/^ssh:\/\//, ``);
    }
  }

  return url;
}

export function normalizeLocator(locator: Locator) {
  return structUtils.makeLocator(locator, normalizeRepoUrl(locator.reference));
}

export async function lsRemote(repo: string, configuration: Configuration) {
  const normalizedRepoUrl = normalizeRepoUrl(repo, {git: true});

  const networkSettings = httpUtils.getNetworkSettings(`https://${GitUrlParse(normalizedRepoUrl).resource}`, {configuration});
  if (!networkSettings.enableNetwork)
    throw new Error(`Request to '${normalizedRepoUrl}' has been blocked because of your configuration settings`);

  const res = await git(`listing refs`, [`ls-remote`, normalizedRepoUrl], {
    cwd: configuration.startingCwd,
    env: makeGitEnvironment(),
  }, {
    configuration,
    normalizedRepoUrl,
  });

  const refs = new Map();

  const matcher = /^([a-f0-9]{40})\t([^\n]+)/gm;
  let match;

  while ((match = matcher.exec(res.stdout)) !== null)
    refs.set(match[2], match[1]);

  return refs;
}

export async function resolveUrl(url: string, configuration: Configuration) {
  const {repo, treeish: {protocol, request}, extra} = splitRepoUrl(url);
  const refs = await lsRemote(repo, configuration);

  const resolve = (protocol: TreeishProtocols | string | null, request: string): string => {
    switch (protocol) {
      case TreeishProtocols.Commit: {
        if (!request.match(/^[a-f0-9]{40}$/))
          throw new Error(`Invalid commit hash`);

        return querystring.stringify({
          ...extra,
          commit: request,
        });
      }

      case TreeishProtocols.Head: {
        const head = refs.get(request === `HEAD` ? request : `refs/heads/${request}`);
        if (typeof head === `undefined`)
          throw new Error(`Unknown head ("${request}")`);

        return querystring.stringify({
          ...extra,
          commit: head,
        });
      }

      case TreeishProtocols.Tag: {
        const tag = refs.get(`refs/tags/${request}`);
        if (typeof tag === `undefined`)
          throw new Error(`Unknown tag ("${request}")`);

        return querystring.stringify({
          ...extra,
          commit: tag,
        });
      }

      case TreeishProtocols.Semver: {
        const validRange = semverUtils.validRange(request);
        if (!validRange)
          throw new Error(`Invalid range ("${request}")`);

        const semverTags = new Map([...refs.entries()].filter(([ref]) => {
          return ref.startsWith(`refs/tags/`);
        }).map<[semver.SemVer | null, string]>(([ref, hash]) => {
          return [semver.parse(ref.slice(10)), hash];
        }).filter((entry): entry is [semver.SemVer, string] => {
          return entry[0] !== null;
        }));

        const bestVersion = semver.maxSatisfying([...semverTags.keys()], validRange);
        if (bestVersion === null)
          throw new Error(`No matching range ("${request}")`);

        return querystring.stringify({
          ...extra,
          commit: semverTags.get(bestVersion),
        });
      }

      case null: {
        let result: string | null;

        if ((result = tryResolve(TreeishProtocols.Commit, request)) !== null)
          return result;
        if ((result = tryResolve(TreeishProtocols.Tag, request)) !== null)
          return result;
        if ((result = tryResolve(TreeishProtocols.Head, request)) !== null)
          return result;

        if (request.match(/^[a-f0-9]+$/)) {
          throw new Error(`Couldn't resolve "${request}" as either a commit, a tag, or a head - if a commit, use the 40-characters commit hash`);
        } else {
          throw new Error(`Couldn't resolve "${request}" as either a commit, a tag, or a head`);
        }
      }

      default: {
        throw new Error(`Invalid Git resolution protocol ("${protocol}")`);
      }
    }
  };

  const tryResolve = (protocol: TreeishProtocols | string | null, request: string): string | null => {
    try {
      return resolve(protocol, request);
    } catch (err) {
      return null;
    }
  };

  return `${repo}#${resolve(protocol, request)}`;
}

export async function clone(url: string, configuration: Configuration) {
  return await configuration.getLimit(`cloneConcurrency`)(async () => {
    const {repo, treeish: {protocol, request}} = splitRepoUrl(url);
    if (protocol !== `commit`)
      throw new Error(`Invalid treeish protocol when cloning`);

    const normalizedRepoUrl = normalizeRepoUrl(repo, {git: true});
    if (httpUtils.getNetworkSettings(`https://${GitUrlParse(normalizedRepoUrl).resource}`, {configuration}).enableNetwork === false)
      throw new Error(`Request to '${normalizedRepoUrl}' has been blocked because of your configuration settings`);

    const directory = await xfs.mktempPromise();
    const execOpts = {cwd: directory, env: makeGitEnvironment()};

    await git(`cloning the repository`, [`clone`, `-c core.autocrlf=false`, normalizedRepoUrl, npath.fromPortablePath(directory)], execOpts, {configuration, normalizedRepoUrl});
    await git(`switching branch`, [`checkout`, `${request}`], execOpts, {configuration, normalizedRepoUrl});

    return directory;
  });
}

export async function fetchRoot(initialCwd: PortablePath) {
  // Note: We can't just use `git rev-parse --show-toplevel`, because on Windows
  // it may return long paths even when the cwd uses short paths, and we have no
  // way to detect it from Node (not even realpath).

  let match: PortablePath | null = null;

  let cwd: PortablePath;
  let nextCwd = initialCwd;
  do {
    cwd = nextCwd;
    if (await xfs.existsPromise(ppath.join(cwd, `.git` as Filename)))
      match = cwd;
    nextCwd = ppath.dirname(cwd);
  } while (match === null && nextCwd !== cwd);

  return match;
}

export async function fetchBase(root: PortablePath, {baseRefs}: {baseRefs: Array<string>}) {
  if (baseRefs.length === 0)
    throw new UsageError(`Can't run this command with zero base refs specified.`);

  const ancestorBases = [];

  for (const candidate of baseRefs) {
    const {code} = await execUtils.execvp(`git`, [`merge-base`, candidate, `HEAD`], {cwd: root});
    if (code === 0) {
      ancestorBases.push(candidate);
    }
  }

  if (ancestorBases.length === 0)
    throw new UsageError(`No ancestor could be found between any of HEAD and ${baseRefs.join(`, `)}`);

  const {stdout: mergeBaseStdout} = await execUtils.execvp(`git`, [`merge-base`, `HEAD`, ...ancestorBases], {cwd: root, strict: true});
  const hash = mergeBaseStdout.trim();

  const {stdout: showStdout} = await execUtils.execvp(`git`, [`show`, `--quiet`, `--pretty=format:%s`, hash], {cwd: root, strict: true});
  const title = showStdout.trim();

  return {hash, title};
}

// Note: This returns all changed files from the git diff,
// which can include files not belonging to a workspace
export async function fetchChangedFiles(root: PortablePath, {base, project}: {base: string, project: Project}) {
  const ignorePattern = miscUtils.buildIgnorePattern(project.configuration.get(`changesetIgnorePatterns`));

  const {stdout: localStdout} = await execUtils.execvp(`git`, [`diff`, `--name-only`, `${base}`], {cwd: root, strict: true});
  const trackedFiles = localStdout.split(/\r\n|\r|\n/).filter(file => file.length > 0).map(file => ppath.resolve(root, npath.toPortablePath(file)));

  const {stdout: untrackedStdout} = await execUtils.execvp(`git`, [`ls-files`, `--others`, `--exclude-standard`], {cwd: root, strict: true});
  const untrackedFiles = untrackedStdout.split(/\r\n|\r|\n/).filter(file => file.length > 0).map(file => ppath.resolve(root, npath.toPortablePath(file)));

  const changedFiles = [...new Set([...trackedFiles, ...untrackedFiles].sort())];

  return ignorePattern
    ? changedFiles.filter(p => !ppath.relative(project.cwd, p).match(ignorePattern))
    : changedFiles;
}

// Note: yarn artifacts are excluded from workspace change detection
// as they can be modified by changes to any workspace manifest file.
export async function fetchChangedWorkspaces({ref, project}: {ref: string | true, project: Project}) {
  if (project.configuration.projectCwd === null)
    throw new UsageError(`This command can only be run from within a Yarn project`);

  const ignoredPaths = [
    ppath.resolve(project.cwd, project.configuration.get(`cacheFolder`)),
    ppath.resolve(project.cwd, project.configuration.get(`installStatePath`)),
    ppath.resolve(project.cwd, project.configuration.get(`lockfileFilename`)),
    ppath.resolve(project.cwd, project.configuration.get(`virtualFolder`)),
  ];
  await project.configuration.triggerHook((hooks: Hooks) => {
    return hooks.populateYarnPaths;
  }, project, (path: PortablePath | null) => {
    if (path != null) {
      ignoredPaths.push(path);
    }
  });

  const root = await fetchRoot(project.configuration.projectCwd);

  if (root == null)
    throw new UsageError(`This command can only be run on Git repositories`);

  const base = await fetchBase(root, {baseRefs: typeof ref === `string` ? [ref] : project.configuration.get(`changesetBaseRefs`)});
  const changedFiles = await fetchChangedFiles(root, {base: base.hash, project});

  return new Set(miscUtils.mapAndFilter(changedFiles, file => {
    const workspace = project.tryWorkspaceByFilePath(file);
    if (workspace === null)
      return miscUtils.mapAndFilter.skip;
    if (ignoredPaths.some(ignoredPath => file.startsWith(ignoredPath)))
      return miscUtils.mapAndFilter.skip;

    return workspace;
  }));
}

async function git(message: string, args: Array<string>, opts: Omit<execUtils.ExecvpOptions, 'strict'>, {configuration, normalizedRepoUrl}: {configuration: Configuration, normalizedRepoUrl: string}) {
  try {
    return await execUtils.execvp(`git`, args, {
      ...opts,
      // The promise won't reject on non-zero exit codes unless we pass the strict option.
      strict: true,
    });
  } catch (error) {
    if (!(error instanceof execUtils.ExecError))
      throw error;

    const execErrorReportExtra = error.reportExtra;

    const stderr = error.stderr.toString();

    throw new ReportError(MessageName.EXCEPTION, `Failed ${message}`, report => {
      report.reportError(MessageName.EXCEPTION, `  ${formatUtils.prettyField(configuration, {
        label: `Repository URL`,
        value: formatUtils.tuple(formatUtils.Type.URL, normalizedRepoUrl),
      })}`);

      for (const match of stderr.matchAll(/^(.+?): (.*)$/gm)) {
        let [, errorName, errorMessage] = match;

        errorName = errorName.toLowerCase();

        const label = errorName === `error`
          ? `Error`
          : `${capitalize(errorName)} Error`;

        report.reportError(MessageName.EXCEPTION, `  ${formatUtils.prettyField(configuration, {
          label,
          value: formatUtils.tuple(formatUtils.Type.NO_HINT, errorMessage),
        })}`);
      }

      execErrorReportExtra?.(report);
    });
  }
}
