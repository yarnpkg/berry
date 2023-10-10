import Link                                                                   from '@docusaurus/Link';
import {useLocation}                                                          from '@docusaurus/router';
import React                                                                  from 'react';

import {STANDARD_EXTENSIONS, usePackageExists, useReleaseInfo, useResolution} from './npmTools';

export type CheckResult = {
  ok: true;
  message?: React.ReactNode;
} | {
  ok: false;
  message?: React.ReactNode;
};

export type Check = {
  id: string;
  defaultEnabled: boolean;
  success: string;
  failure: string;
  useCheck: (params: {name: string, version: string}) => CheckResult;
};

export const checks: Array<Check> = [{
  id: `deprecated`,
  defaultEnabled: true,
  success: `This package isn't deprecated`,
  failure: `This package has been marked deprecated`,
  useCheck: ({name, version}) => {
    const releaseInfo = useReleaseInfo({
      name,
      version,
    });

    if (releaseInfo.npm.deprecated)
      return {ok: false};

    return {ok: true};
  },
}, {
  id: `cjs`,
  defaultEnabled: true,
  success: `The package has a commonjs entry point`,
  failure: `The package doesn't seem to have a commonjs entry point`,
  useCheck: ({name, version}) => {
    if (name.startsWith(`@types/`))
      return {ok: true};

    const releaseInfo = useReleaseInfo({
      name,
      version,
    });

    const resolution = useResolution({
      name,
      version,
    }, {
      mainFields: [`main`],
      conditions: [`default`, `require`, `node`],
    });

    if (!resolution || resolution.endsWith(`.mjs`))
      return {ok: false};

    if (resolution.endsWith(`.js`) && releaseInfo.npm.type === `module`)
      return {ok: false};

    return {ok: true};
  },
}, {
  id: `esm`,
  defaultEnabled: false,
  success: `The package has an ESM entry point`,
  failure: `The package doesn't seem to have an ESM entry point`,
  useCheck: ({name, version}) => {
    if (name.startsWith(`@types/`))
      return {ok: true};

    const releaseInfo = useReleaseInfo({
      name,
      version,
    });

    const resolution = useResolution({
      name,
      version,
    }, {
      mainFields: [`main`],
      conditions: [`default`, `import`, `node`],
    });

    if (!resolution || resolution.endsWith(`.cjs`))
      return {ok: false};

    if (resolution.endsWith(`.js`) && releaseInfo.npm.type !== `module`)
      return {ok: false};

    return {ok: true};
  },
}, {
  id: `postinstall`,
  defaultEnabled: true,
  success: `The package doesn't have postinstall scripts`,
  failure: `The package has postinstall scripts`,
  useCheck: ({name, version}) => {
    const releaseInfo = useReleaseInfo({
      name,
      version,
    });

    for (const name of [`preinstall`, `install`, `postinstall`])
      if (releaseInfo.npm.scripts?.[name])
        return {ok: false};

    return {ok: true};
  },
}, {
  id: `types`,
  defaultEnabled: true,
  success: `The package ships with types`,
  failure: `The package doesn't ship with types`,
  useCheck: ({name, version}) => {
    const location = useLocation();

    const releaseInfo = useReleaseInfo({
      name,
      version,
    });

    const tsExtensions = [
      ...STANDARD_EXTENSIONS.map(ext => ext.replace(`js`, `ts`)),
      ...STANDARD_EXTENSIONS.map(ext => ext.replace(`js`, `tsx`)),
      `.d.ts`,
    ];

    const extensions = [
      ...STANDARD_EXTENSIONS,
      ...tsExtensions,
    ];

    const resolution = useResolution({
      name,
      version,
    }, {
      mainFields: [`main`, `types`, `typings`],
      conditions: [`default`, `require`, `import`, `node`, `types`],
      extensions,
    });

    const dtPackageName = !name.startsWith(`@types`)
      ? `@types/${name.replace(/^@([^/]*)\/([^/]*)$/, `$1__$2`)}`
      : null;

    const dtPackage = usePackageExists(dtPackageName);

    const fileNoExt = resolution?.replace(/(\.[mc]?(js|ts)x?|\.d\.ts)$/, ``);
    for (const ext of tsExtensions)
      if (releaseInfo.jsdelivr.fileSet.has(`${fileNoExt}${ext}`))
        return {ok: true};

    if (dtPackageName && dtPackage) {
      const search = new URLSearchParams(location.search);

      for (const key of search.keys())
        if (key !== `q`)
          search.delete(key);

      search.set(`name`, dtPackageName);

      const href = `/package?${search}`;
      return {ok: true, message: <>Types are available via <Link href={href}>{dtPackageName}</Link></>};
    }

    return {ok: false};
  },
}];
