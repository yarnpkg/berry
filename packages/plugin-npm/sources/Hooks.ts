import {Configuration, Ident} from '@yarnpkg/core';

export type Hooks = {
  getNpmAuthenticationHeader?: (currentHeader: string | undefined, registry: string, {
    configuration,
    ident,
  }: { configuration: Configuration, ident?: Ident }) => Promise<string | undefined>;
};
