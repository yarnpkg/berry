import BrowserOnly                                                                                                               from '@docusaurus/BrowserOnly';
import {useLocation}                                                                                                             from '@docusaurus/router';
// @ts-expect-error
import {DocsSidebarProvider}                                                                                                     from '@docusaurus/theme-common/internal';
import {HtmlClassNameProvider}                                                                                                   from '@docusaurus/theme-common';
import Editor                                                                                                                    from '@monaco-editor/react';
import {AlertIcon, ArrowLeftIcon, CheckIcon, FileDirectoryFillIcon, FileIcon, HomeIcon, HourglassIcon, MarkGithubIcon, PlayIcon} from '@primer/octicons-react';
import clsx                                                                                                                      from 'clsx';
import MarkdownIt                                                                                                                from 'markdown-it';
import pako                                                                                                                      from 'pako';
import React, {useEffect, useState}                                                                                              from 'react';

import Layout                                                                                                                    from '../theme/DocPage/Layout/index.js';

import styles                                                                                                                    from './listing.module.css';

type CheckResult = {
  ok: true;
} | {
  ok: false;
  message: string;
};

type Check = {
  success: string;
  failure: string;
  check: (filesDict: Map<string, File>) => Promise<CheckResult>;
};

type File = {
  name: string;
  buffer: ArrayBuffer;
};

const md = new MarkdownIt();

function getFileContent(file: File) {
  return new TextDecoder().decode(file.buffer);
}

function getPackageJson(filesDict: Map<string, File>) {
  const pkgFile = filesDict.get(`package.json`);
  if (!pkgFile)
    throw new Error(`No package.json file`);

  let manifest;
  try {
    manifest = JSON.parse(getFileContent(pkgFile));
  } catch {
    throw new Error(`Invalid package.json file`);
  }

  return manifest;
}

function getExportsConfiguration(filesDict: Map<string, File>) {
  const pkgFile = getPackageJson(filesDict);
  const exports = pkgFile.exports ?? pkgFile.main ?? `index`;

  const exportsAsObject = typeof exports === `string`
    ? {[`.`]: exports}
    : exports;

  for (const [key, value] of Object.entries(exportsAsObject)) {
    exportsAsObject[key] = Object.assign({}, ...[value].flat().map(value => {
      return typeof value === `string` ? {default: value} : value;
    }));
  }

  return exportsAsObject;
}

function normalizeModulePath(modulePath: string, filesDict: Map<string, File>, resolveExtension: Array<string> = []) {
  modulePath = new URL(modulePath, `https://example.com/`).pathname.slice(1);

  for (const candidatePath of [modulePath, `${modulePath}/index`]) {
    if (filesDict.has(candidatePath))
      return modulePath;

    for (const ext of resolveExtension) {
      if (filesDict.has(`${candidatePath}${ext}`)) {
        return `${candidatePath}${ext}`;
      }
    }
  }

  throw new Error(`Failed to resolve the module path`);
}

const checks: Array<Check> = [{
  success: `The package has a commonjs entry point`,
  failure: `The package doesn't seem to have a commonjs entry point`,
  check: async filesDict => {
    const pkgFile = getPackageJson(filesDict);
    const exportsConfiguration = getExportsConfiguration(filesDict);

    const entryPoint = exportsConfiguration[`.`];

    const commonjsEntryPoint = entryPoint.require ?? entryPoint.default;
    const resolvedEntryPoint = normalizeModulePath(commonjsEntryPoint, filesDict, [`.cjs`, `.js`]);

    if (resolvedEntryPoint.endsWith(`.js`) && pkgFile.type === `module`)
      throw new Error(`Entry point isn't CJS`);

    return {ok: true};
  },
}, {
  success: `The package doesn't have postinstall scripts`,
  failure: `The package has postinstall scripts`,
  check: async filesDict => {
    const pkgJson = getPackageJson(filesDict);

    if (pkgJson.scripts)
      for (const scriptName of [`preinstall`, `install`, `postinstall`])
        if (typeof pkgJson.scripts[scriptName] !== `undefined`)
          throw new Error(`Found a ${scriptName} script`);

    if (filesDict.has(`bindings.gyp`))
      throw new Error(`Found a bindings.gyp file`);

    return {ok: true};
  },
}, {
  success: `The package ships with types`,
  failure: `The package doesn't ship with types`,
  check: async filesDict => {
    const pkgJson = getPackageJson(filesDict);
    const exportsConfiguration = getExportsConfiguration(filesDict);

    const typesEntryPoint = pkgJson.types ?? pkgJson.typings ?? Object.values(exportsConfiguration[`.`])[0];
    const typesEntryPointNoExt = typesEntryPoint.replace(/(\.[mc]?(js|ts)x?|\.d\.ts)$/, ``);
    normalizeModulePath(typesEntryPointNoExt, filesDict, [`.mtsx`, `.mts`, `.tsx`, `ts`, `.d.ts`]);

    return {ok: true};
  },
}];

const SidebarEntry = ({icon: Icon, name}: {icon: React.FunctionComponent, name: string}) => (
  <div className={clsx(styles.entry, `text--truncate`)}>
    <Icon/> {name}
  </div>
);

function getSidebarFromFiles(name: string, version: string, filesDict: Map<string, File>, getUrl: (file: string | null) => string) {
  const packageJson = getPackageJson(filesDict);

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

  const toolsSidebar = Object.assign(makeCategory(`${name} @ ${version}`), {
    collapsed: false,
    collapsible: false,

    href: getUrl(null),
  });

  if (packageJson.homepage) {
    toolsSidebar.items.push({
      type: `link`,
      label: <SidebarEntry icon={HomeIcon} name={`Homepage`}/>,
      href: packageJson.homepage,
    });
  }

  if (packageJson.repository?.url) {
    toolsSidebar.items.push({
      type: `link`,
      label: <SidebarEntry icon={MarkGithubIcon} name={`Repository`}/>,
      href: packageJson.repository?.url,
    });
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

  const packageSidebar = Object.assign(makeCategory(`package`), {
    collapsed: false,
    collapsible: false,
  });

  for (const file of filesDict.values()) {
    const segments = file.name.split(/\//g);

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

  return [
    toolsSidebar,
    packageSidebar,
  ];
}

async function getPackageInfo(name: string | null, version: string | null, getUrl: (file: string | null) => string) {
  if (name === null || version === null)
    throw new Error(`Missing mandatory search parameters`);

  // eslint-disable-next-line no-restricted-globals
  const req = await fetch(`https://registry.yarnpkg.com/${name}/-/${name.replace(/^@[^/]+\//, ``)}-${version}.tgz`);
  const res = await req.arrayBuffer();

  // @ts-expect-error
  const {default: untar} = await import(`js-untar`);

  const uncompressed = pako.ungzip(res).buffer;
  const unpacked: Array<File> = await untar(uncompressed);

  for (const file of unpacked)
    file.name = file.name.replace(/^[^/]*\/+/, ``);

  const filesDict = new Map<string, File>();
  for (const file of unpacked)
    filesDict.set(file.name.toLowerCase(), file);

  return {
    filesDict,
    sidebar: getSidebarFromFiles(name, version, filesDict, getUrl),
  };
}

function ReportView({name, version, filesDict}: {name: string, version: string, filesDict: Map<string, File>}) {
  const readmeFile = filesDict.get(`readme.md`);

  let readmeText = readmeFile
    ? getFileContent(readmeFile)
    : ``;

  // We don't want the Readme header; we'll put our own
  readmeText = readmeText.replace(/^\s*#[^\n]*\n+((?![`[]])[^\n]*\n)?\s*/, ``);

  return (
    <div className={`row`}>
      <div className={`col`}>
        <div className={`theme-doc-markdown markdown`}>
          <h1>{name} @ {version}</h1>
          <table className={styles.reportTable}>
            <tbody>
              {checks.map((check, index) => <ReportCheck key={index} filesDict={filesDict} check={check}/>)}
            </tbody>
          </table>
          <div className={`theme-doc-markdown markdown`}>
            <div dangerouslySetInnerHTML={{__html: md.render(readmeText)}}/>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportCheck({filesDict, check}: {filesDict: Map<string, File>, check: Check}) {
  const [result, setResult] = useState<CheckResult | null>(null);

  useEffect(() => {
    check.check(filesDict).then(result => {
      setResult(result);
    }, err => {
      setResult({ok: false, message: err.message});
    });
  }, [filesDict]);

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

  return (
    <tr className={styles.reportLine}>
      <td>
        <div className={clsx(styles.reportCheckContainer, checkClass)}>
          {icon}
        </div>
      </td>
      <td>
        <div className={styles.reportLabel}>
          {result?.ok === false ? check.failure : check.success}
        </div>
      </td>
    </tr>
  );
}

function FileView({file}: {file: File}) {
  return (
    <Editor path={file.name} defaultValue={getFileContent(file)} options={{readOnly: true}}/>
  );
}

function PackageInfoPage() {
  const [packageInfo, setPackageInfo] = useState<{
    filesDict: Map<string, File>;
    sidebar: any;
  } | null>(null);

  const location = useLocation();
  const search = new URLSearchParams(location.search.slice(1));
  const query = search.get(`q`);
  const name = search.get(`name`);
  const version = search.get(`version`);
  const filePath = search.get(`file`);

  const searchNoFile = new URLSearchParams(location.search.slice(1));
  searchNoFile.delete(`file`);
  const searchNoFileString = searchNoFile.toString();

  useEffect(() => {
    Promise.resolve().then(async () => {
      setPackageInfo(await getPackageInfo(name, version, file => {
        if (file === null)
          return `?${searchNoFileString}`;

        const searchFile = new URLSearchParams(searchNoFileString);
        searchFile.set(`file`, file);
        return `?${searchFile.toString()}`;
      }));
    });
  }, [name, version, searchNoFileString]);

  const file = filePath
    ? packageInfo?.filesDict.get(filePath.toLowerCase()) ?? null
    : null;

  const children = file
    ? <FileView file={file}/>
    : packageInfo
      ? <ReportView name={name!} version={version!} filesDict={packageInfo.filesDict}/>
      : null;

  const sidebarItems = packageInfo
    ? [...packageInfo.sidebar]
    : [];

  if (typeof query === `string`) {
    sidebarItems.unshift({
      type: `link`,
      label: <SidebarEntry icon={ArrowLeftIcon} name={`Back to search`}/>,
      href: `/packages?q=${encodeURIComponent(query)}`,
    }, {
      type: `html`,
      value: `<div style="height: 10px"/>`,
    });
  }

  return (
    <HtmlClassNameProvider className={clsx(styles.html, !!file && styles.fileHtml)}>
      <DocsSidebarProvider name={`foo`} items={sidebarItems}>
        <Layout>
          {children}
        </Layout>
      </DocsSidebarProvider>
    </HtmlClassNameProvider>
  );
}

// eslint-disable-next-line arca/no-default-export
export default function PackageInfoPageWrapper() {
  return (
    <BrowserOnly>
      {() => <PackageInfoPage/>}
    </BrowserOnly>
  );
}
