import {Plugin}              from '@berry/core';

import {FileFetcher}         from './FileFetcher';
import {FileResolver}        from './FileResolver';
import {TarballFileFetcher}  from './TarballFileFetcher';
import {TarballFileResolver} from './TarballFileResolver';

const plugin: Plugin = {
  fetchers: [
    TarballFileFetcher,
    FileFetcher,
  ],
  resolvers: [
    TarballFileResolver,
    FileResolver,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
