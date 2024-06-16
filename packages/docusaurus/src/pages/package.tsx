import BrowserOnly                                                                                                                                                                from '@docusaurus/BrowserOnly';
import {useLocation}                                                                                                                                                              from '@docusaurus/router';
import {DocsSidebarProvider}                                                                                                                                                      from '@docusaurus/theme-common/internal';
import {HtmlClassNameProvider}                                                                                                                                                    from '@docusaurus/theme-common';
import Editor                                                                                                                                                                     from '@monaco-editor/react';
import {AlertIcon, ArrowLeftIcon, CheckIcon, FileDirectoryFillIcon, FileIcon, GearIcon, GlobeIcon, HomeIcon, HourglassIcon, ListUnorderedIcon, MarkGithubIcon, PlayIcon, TagIcon} from '@primer/octicons-react';
import DocRootLayout                                                                                                                                                              from '@theme/DocRoot/Layout';
import Layout                                                                                                                                                                     from '@theme/Layout';
import {normalizeRepoUrl}                                                                                                                                                         from '@yarnpkg/monorepo/packages/plugin-git/sources/utils/normalizeRepoUrl';
import clsx                                                                                                                                                                       from 'clsx';
import gitUrlParse                                                                                                                                                                from 'git-url-parse';
import Select, {MenuListProps}                                                                                                                                                    from 'react-select';
import {FixedSizeList}                                                                                                                                                            from 'react-window';
import React, {Suspense, useReducer}                                                                                                                                              from 'react';
import semver                                                                                                                                                                     from 'semver';
import {useLocalStorage}                                                                                                                                                          from 'usehooks-ts';

import {usePackageInfo, useReleaseFile, useReleaseInfo, useReleaseReadme, useResolvedVersion}                                                                                     from '../lib/npmTools';
import {Check, checks}                                                                                                                                                            from '../lib/packageChecks';

import styles                                                                                                                                                                     from './package.module.css';

const SidebarEntry = ({icon: Icon, name, extra}: {icon: React.FunctionComponent, name: string, extra?: string}) => (
  <div className={styles.sidebarEntry}>
    <div className={styles.sidebarIcon}>
      <Icon/>
    </div>
    <div className={clsx(styles.sidebarName, `text--truncate`)}>
      {name}
    </div>
    {extra && <div className={clsx(styles.sidebarExtra, `text--truncate`)}>
      {extra}
    </div>}
  </div>
);

function useReleaseSidebar({name, version}: {name: string, version: string}) {
  const location = useLocation();

  const pkgInfo = usePackageInfo(name);
  const releaseInfo = useReleaseInfo({
    name,
    version,
  });

  const makeCategory = (name: string) => ({
    type: `category`,
    label: <SidebarEntry icon={FileDirectoryFillIcon} name={name}/>,
    href: undefined as string | undefined,
    items: [] as Array<any>,
    itemsDict: new Map(),
    collapsed: true,
    collapsible: true,
  });

  const attachCategory = (parent: ReturnType<typeof makeCategory>, name: string) => {
    let category = parent.itemsDict.get(name);
    if (typeof category === `undefined`) {
      parent.itemsDict.set(name, category = makeCategory(name));
      parent.items.push(category);
    }

    return category;
  };

  const getUrl = (file: string | null | undefined, version?: string) => {
    const newSearch = new URLSearchParams(location.search);

    if (typeof file !== `undefined`) {
      if (file !== null) {
        newSearch.set(`file`, file);
      } else {
        newSearch.delete(`file`);
      }
    }

    if (typeof version !== `undefined`)
      newSearch.set(`version`, version);

    const newSearchStr = newSearch.toString();
    return `?${newSearchStr}`;
  };

  const toolsSidebar = Object.assign(makeCategory(`${name} @ ${version}`), {
    collapsed: false,
    collapsible: false,

    href: getUrl(null),
  });

  toolsSidebar.items.push({
    type: `link`,
    label: <SidebarEntry icon={HomeIcon} name={`Information`}/>,
    href: getUrl(null),
  });

  if (typeof releaseInfo.npm.homepage === `string`) {
    toolsSidebar.items.push({
      type: `link`,
      label: <SidebarEntry icon={GlobeIcon} name={`Website`}/>,
      href: releaseInfo.npm.homepage,
    });
  }

  if (typeof releaseInfo.npm.repository?.url === `string`) {
    const normalizedRepository = normalizeRepoUrl(releaseInfo.npm.repository.url);
    const repositoryInfo = gitUrlParse(normalizedRepository);

    let repositoryUrl: string | undefined;
    switch (repositoryInfo.source) {
      case `github.com`: {
        if (repositoryInfo.owner && repositoryInfo.name) {
          repositoryUrl = `https://github.com/${repositoryInfo.owner}/${repositoryInfo.name}`;
          if (typeof releaseInfo.npm.repository.directory === `string`) {
            repositoryUrl += `/tree/${releaseInfo.npm.repository.directory}`;
          }
        }
      } break;
    }
    if (typeof repositoryUrl !== `undefined`) {
      toolsSidebar.items.push({
        type: `link`,
        label: <SidebarEntry icon={MarkGithubIcon} name={`Repository`}/>,
        href: repositoryUrl,
      });
    }
  }

  toolsSidebar.items.push({
    type: `link`,
    label: <SidebarEntry icon={PlayIcon} name={`Runkit`}/>,
    href: `https://npm.runkit.com/${name}`,
  });

  toolsSidebar.items.push({
    type: `html`,
    value: `<div style="height: 10px"/>`,
  });

  const tagsSidebar = Object.assign(makeCategory(`Tags`), {
    collapsed: false,
    collapsible: true,
  });

  const tagVersions = Object.entries(pkgInfo[`dist-tags`]).sort((a, b) => {
    return semver.compare(a[1], b[1]);
  });

  // Remove all tags that were last published before latest
  const latestIndex = tagVersions.findIndex(([tag]) => tag === `latest`);
  tagVersions.splice(0, latestIndex);

  for (const [tag, version] of tagVersions) {
    tagsSidebar.items.push({
      type: `link`,
      label: <SidebarEntry icon={TagIcon} name={tag} extra={version}/>,
      href: getUrl(undefined, version),
    });
  }

  const versionsSidebar = Object.assign(makeCategory(`Versions`), {
    collapsed: true,
    collapsible: true,
  });

  const taggedVersions = new Set(Object.values(pkgInfo[`dist-tags`]));

  const versions = Object.keys(pkgInfo.versions).filter(version => {
    return semver.prerelease(version) === null || taggedVersions.has(version);
  });

  versions.sort(semver.rcompare);

  for (const version of versions) {
    versionsSidebar.items.push({
      type: `link`,
      label: <SidebarEntry icon={TagIcon} name={version}/>,
      href: getUrl(undefined, version),
    });
  }

  const packageSidebar = Object.assign(makeCategory(`Files`), {
    collapsed: true,
    collapsible: true,
  });

  for (const file of releaseInfo.jsdelivr.files.values()) {
    const segments = file.name.slice(1).split(/\//g);

    let parent = packageSidebar;
    for (let t = 0; t < segments.length - 1; ++t)
      parent = attachCategory(parent, segments[t]);

    parent.items.push({
      type: `link`,
      label: <SidebarEntry icon={FileIcon} name={segments[segments.length - 1]}/>,
      href: getUrl(file.name),
    });
  }

  const sortCategory = (category: ReturnType<typeof makeCategory>) => {
    category.items = category.items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === `category` ? +1 : -1;
      } else {
        return a.name < b.name ? -1 : a.name > b.name ? +1 : 0;
      }
    });

    for (const item of category.items) {
      if (item.type === `category`) {
        sortCategory(item);
      }
    }
  };

  sortCategory(packageSidebar);

  const sidebar: Array<any> = [
    toolsSidebar,
    tagsSidebar,
    versionsSidebar,
    packageSidebar,
  ];

  const search = new URLSearchParams(location.search);
  const query = search.get(`q`);

  if (typeof query === `string`) {
    sidebar.unshift({
      type: `link`,
      label: <SidebarEntry icon={ArrowLeftIcon} name={`Back to search`}/>,
      href: `/search?q=${encodeURIComponent(query)}`,
    }, {
      type: `html`,
      value: `<div style="height: 10px"/>`,
    });
  }

  return sidebar;
}

type VersionChoice = {
  value: string;
  label: string;
  time: Date;
};

const rtf1 = new Intl.RelativeTimeFormat(`en`, {numeric: `auto`});

const now = Date.now();

const DURATION_THRESHOLDS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  [`day`, 1000 * 60 * 60 * 24],
  [`month`, 1000 * 60 * 60 * 24 * 31],
  [`year`, 1000 * 60 * 60 * 24 * 365],
];

function bestDurationUnit(duration: number): [number, Intl.RelativeTimeFormatUnit] {
  let best = 0;

  while (best + 1 < DURATION_THRESHOLDS.length && duration > DURATION_THRESHOLDS[best + 1][1])
    best += 1;

  return [-Math.round(duration / DURATION_THRESHOLDS[best][1]), DURATION_THRESHOLDS[best][0]];
}

const ITEM_HEIGHT = 35;

const MenuList = ({options, children, maxHeight, getValue}: MenuListProps<VersionChoice>) => {
  const [value] = getValue();
  const initialOffset = options.indexOf(value) * ITEM_HEIGHT;

  const items = Array.isArray(children)
    ? children
    : children
      ? [<React.Fragment key={0}>{children}</React.Fragment>]
      : [];

  return (
    <FixedSizeList
      width={`100%`}
      height={Math.min(maxHeight, items.length * ITEM_HEIGHT)}
      itemCount={items.length}
      itemSize={ITEM_HEIGHT}
      initialScrollOffset={initialOffset}
    >
      {({index, style}) => <div style={style}>{items[index]}</div>}
    </FixedSizeList>
  );
};

function VersionSelector({name, version}: {name: string, version: string}) {
  const pkgInfo = usePackageInfo(name);

  const copy = {...pkgInfo.time};
  delete copy.created;
  delete copy.modified;

  const latest = pkgInfo[`dist-tags`].latest;

  const options: Array<VersionChoice> = Object.entries(copy).map(([version, releaseTime]) => ({
    value: version,
    label: ``,
    time: new Date(releaseTime),
  })).sort((a, b) => {
    return b.time.getTime() - a.time.getTime();
  }).filter(({value: version}, index) => {
    // Don't show deprecated packages
    if (pkgInfo.versions[version] && pkgInfo.versions[version].deprecated)
      return false;

    const prerelease = semver.prerelease(version);

    // Don't show old prereleases
    if (latest && prerelease && semver.gt(latest, version))
      return false;

    // Don't show nightly releases
    if (version.match(/-.*2[0-9]{3}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])/) && index > 0)
      return false;

    return true;
  });

  const selected = options.find(option => {
    return option.value === version;
  });

  const formatOptionLabel = (option: VersionChoice) => {
    return <>
      <div className={styles.versionSelectorOption}>
        <div className={styles.versionSelectorVersion}>
          {option.value}
        </div>
        <div className={styles.versionSelectorExtra}>
          {rtf1.format(...bestDurationUnit(now - option.time.getTime()))}
        </div>
      </div>
    </>;
  };

  const handleChange = (value: VersionChoice | null) => {
    const search = new URLSearchParams(location.search);

    if (value !== null)
      search.set(`version`, value.value);
    else
      search.delete(`version`);

    location.replace(`?${search.toString()}`);
  };

  return (
    <Select<VersionChoice> className={styles.versionSelector} options={options} value={selected} components={{MenuList}} formatOptionLabel={formatOptionLabel} onChange={handleChange}/>
  );
}

function ReportView({name, version}: {name: string, version: string}) {
  const readme = useReleaseReadme({
    name,
    version,
  });

  const [isEditMode, toggleEditMode] = useReducer(value => {
    return !value;
  }, false);

  return (
    <div className={`row`}>
      <div className={`col`}>
        <div className={`theme-doc-markdown markdown`}>
          <h1 className={styles.reportTitle}>
            <div>{name}</div>
            <VersionSelector name={name} version={version}/>
          </h1>
          <div className={styles.reportTableContainer}>
            <table>
              <tbody>
                <tr>
                  <td></td>
                  <td></td>
                  <td onClick={() => toggleEditMode()}>
                    <div className={styles.reportCheckContainer} data-tooltip-id={`tooltip`} data-tooltip-content={`Click here to pick the status checks you're interested in`}>
                      <GearIcon/>
                    </div>
                  </td>
                </tr>
                {checks.map((check, index) => <ReportCheck key={index} name={name} version={version} check={check} isEditMode={isEditMode}/>)}
              </tbody>
            </table>
          </div>
          <div className={styles.reportReadme}>
            <div className={styles.reportReadmeIcon}>
              <ListUnorderedIcon/>
            </div>
            <div className={styles.reportReadmeText}>
              README
            </div>
          </div>
          <div className={clsx(styles.reportMain, `markdown-body`)}>
            <div dangerouslySetInnerHTML={{__html: readme}}/>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportCheck({name, version, check, isEditMode}: {name: string, version: string, check: Check, isEditMode: boolean}) {
  const [selected, setSelected] = useLocalStorage(`check/${check.id}`, check.defaultEnabled);

  const result = check.useCheck({
    name,
    version,
  });

  const icon = result
    ? result.ok
      ? <CheckIcon/>
      : <AlertIcon/>
    : <HourglassIcon/>;

  const checkClass = result
    ? result.ok
      ? styles.reportCheckSuccess
      : styles.reportCheckFailure
    : undefined;

  if (!isEditMode && !selected)
    return null;

  if (!isEditMode && result.ok && !result.message)
    return null;

  return (
    <tr className={styles.reportLine}>
      <td>
        <div className={clsx(styles.reportCheckContainer, checkClass)}>
          {icon}
        </div>
      </td>
      <td colSpan={isEditMode ? 1 : 2}>
        <div className={styles.reportCheckLabel}>
          {result.message ?? (result.ok ? check.success : check.failure)}
        </div>
      </td>
      {isEditMode && <td>
        <label className={styles.reportCheckContainer}>
          <input type={`checkbox`} onChange={e => setSelected(e.target.checked)} checked={selected}/>
        </label>
      </td>}
    </tr>
  );
}

function FileView({name, version, path}: {name: string, version: string, path: string}) {
  const file = useReleaseFile({
    name,
    version,
  }, path);

  if (file === null)
    return <>File not found</>;

  return (
    <Editor path={`${name}/${version}/${path}`} defaultValue={file} options={{readOnly: true}}/>
  );
}

function SidebarProvider({name, version, children}: {name: string, version: string, children: React.ReactNode}) {
  const releaseInfo = useReleaseInfo({
    name,
    version,
  });

  const sidebar = useReleaseSidebar(releaseInfo);

  return (
    <DocsSidebarProvider name={`foo`} items={sidebar}>
      {children}
    </DocsSidebarProvider>
  );
}

function LoadingPage() {
  return (
    <HtmlClassNameProvider className={clsx(styles.html)}>
      <Layout title={`Package loading...`}>
        <DocsSidebarProvider name={`foo`} items={[]}>
          <DocRootLayout>
            Loading in progress
          </DocRootLayout>
        </DocsSidebarProvider>
      </Layout>
    </HtmlClassNameProvider>
  );
}

function PackageInfoPage() {
  const location = useLocation();

  const search = new URLSearchParams(location.search.slice(1));
  const name = search.get(`name`)!;
  const path = search.get(`file`);

  const version = useResolvedVersion({
    name,
    version: search.get(`version`),
  });

  const children = path
    ? <FileView name={name} version={version} path={path}/>
    : <ReportView name={name} version={version}/>;

  return (
    <HtmlClassNameProvider className={clsx(styles.html, !!path && styles.fileHtml)}>
      <Layout title={name}>
        <SidebarProvider name={name} version={version}>
          <DocRootLayout>
            {children}
          </DocRootLayout>
        </SidebarProvider>
      </Layout>
    </HtmlClassNameProvider>
  );
}

// eslint-disable-next-line arca/no-default-export
export default function PackageInfoPageWrapper() {
  return (
    <BrowserOnly>
      {() => (
        <Suspense fallback={<LoadingPage/>}>
          <PackageInfoPage/>
        </Suspense>
      )}
    </BrowserOnly>
  );
}
