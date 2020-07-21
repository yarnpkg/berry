import {Plugin}              from '@yarnpkg/core';

import {FileFetcher}         from './FileFetcher';
import {FileResolver}        from './FileResolver';
import {TarballFileFetcher}  from './TarballFileFetcher';
import {TarballFileResolver} from './TarballFileResolver';
import * as fileUtils        from './fileUtils';

export {fileUtils};

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
