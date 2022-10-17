import {useLocation}                     from '@docusaurus/router';
// @ts-expect-error
import {DocsSidebarProvider}             from '@docusaurus/theme-common/internal';
import {HtmlClassNameProvider}           from '@docusaurus/theme-common';
import {FileDirectoryFillIcon, FileIcon} from '@primer/octicons-react';
// @ts-expect-error
import untar                             from 'js-untar';
import pako                              from 'pako';
import React, {useEffect, useState}      from 'react';

import Layout                            from '../theme/DocPage/Layout/index.js';

import styles                            from './listing.module.css';

const Entry = ({icon: Icon, name}: any) => (
  <div className={styles.entry}>
    <Icon/> {name}
  </div>
);

function getSidebarFromFiles(name: string, version: string, files: Array<any>) {
  const makeCategory = (name: string, {collapsed = true}: {collapsed?: boolean} = {}) => ({
    type: `category`,
    label: <Entry icon={FileDirectoryFillIcon} name={name}/>,
    items: [] as Array<any>,
    itemsDict: new Map(),
    collapsed,
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

  const sidebar = makeCategory(`${name} @ ${version}`, {
    collapsed: false,
  });

  for (const file of files) {
    const segments = file.name.split(/\//g);

    let parent = sidebar;
    for (let t = 1; t < segments.length - 1; ++t)
      parent = attachCategory(parent, segments[t]);

    const qs = new URLSearchParams();
    qs.set(`name`, name);
    qs.set(`version`, version);
    qs.set(`file`, file.name);

    parent.items.push({
      type: `link`,
      label: <Entry icon={FileIcon} name={segments[segments.length - 1]}/>,
      href: `/listing?${qs.toString()}`,
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

  sortCategory(sidebar);

  return [sidebar];
}

async function getPackageInfo(name: string | null, version: string | null, path: string | null) {
  if (name === null || version === null)
    throw new Error(`Missing mandatory search parameters`);

  const req = await fetch(`https://registry.yarnpkg.com/${name}/-/${name}-${version}.tgz`);
  const res = await req.arrayBuffer();

  const uncompressed = pako.ungzip(res).buffer;
  const unpacked = await untar(uncompressed);

  const sidebar = getSidebarFromFiles(name, version, unpacked);
  let children = null;

  if (path !== null)
    children = <pre className={styles.fileContent}><code>{new TextDecoder().decode(unpacked.find((file: any) => file.name === path)?.buffer)}</code></pre>;

  return {sidebar, children};
}

// eslint-disable-next-line arca/no-default-export
export default function Run() {
  const [state, setState] = useState<{
    sidebar: Array<any>;
    children: any;
  } | null>(null);

  const location = useLocation();
  const search = new URLSearchParams(location.search.slice(1));
  const name = search.get(`name`);
  const version = search.get(`version`);
  const file = search.get(`file`);

  useEffect(() => {
    getPackageInfo(name, version, file).catch(() => ({
      sidebar: [],
      children: null,
    })).then(setState);
  }, [name, version, file]);

  return (
    <HtmlClassNameProvider className={styles.html}>
      <DocsSidebarProvider name={`foo`} items={state?.sidebar}>
        <Layout>
          {state?.children}
        </Layout>
      </DocsSidebarProvider>
    </HtmlClassNameProvider>
  );
}
