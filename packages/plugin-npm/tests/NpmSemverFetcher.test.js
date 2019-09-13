import {structUtils}       from '@yarnpkg/core';

import {NpmSemverFetcher}  from '../sources/NpmSemverFetcher';

import {makeConfiguration} from './_makeConfiguration';

describe(`NpmSemverFetcher`, () => {
  describe(`isConventionalTarballUrl`, () => {
    it(`it should detect a conventional path (foo)`, async () => {
      const configuration = await makeConfiguration();

      const locator = structUtils.makeLocator(structUtils.makeIdent(null, `foo`), `npm:1.0.0`);
      const url = `${configuration.get(`npmRegistryServer`)}/foo/-/foo-1.0.0.tgz`;

      expect(NpmSemverFetcher.isConventionalTarballUrl(locator, url, {configuration})).toEqual(true);
    });

    it(`it should detect a conventional path (@scope/foo)`, async () => {
      const configuration = await makeConfiguration();

      const locator = structUtils.makeLocator(structUtils.makeIdent(`scope`, `foo`), `npm:1.0.0`);
      const url = `${configuration.get(`npmRegistryServer`)}/@scope/foo/-/foo-1.0.0.tgz`;

      expect(NpmSemverFetcher.isConventionalTarballUrl(locator, url, {configuration})).toEqual(true);
    });

    it(`it should detect a conventional path (@scope%2ffoo)`, async () => {
      const configuration = await makeConfiguration();

      const locator = structUtils.makeLocator(structUtils.makeIdent(`scope`, `foo`), `npm:1.0.0`);
      const url = `${configuration.get(`npmRegistryServer`)}/@scope%2ffoo/-/foo-1.0.0.tgz`;

      expect(NpmSemverFetcher.isConventionalTarballUrl(locator, url, {configuration})).toEqual(true);
    });
  });
});

