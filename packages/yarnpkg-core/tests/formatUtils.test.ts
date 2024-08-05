import {Configuration, structUtils} from '@yarnpkg/core';
import {PortablePath}               from '@yarnpkg/fslib';

import * as formatUtils             from '../sources/formatUtils';

const configuration = Configuration.create(PortablePath.root);
configuration.use(`<test>`, {enableColors: false}, PortablePath.root, {overwrite: true});

const LOCATORS = [
  structUtils.parseLocator(`foo@npm:1.0.0`),
  structUtils.parseLocator(`foo@npm:2.0.0`),
  structUtils.parseLocator(`foo@npm:3.0.0`),
  structUtils.parseLocator(`foo@npm:4.0.0`),
  structUtils.parseLocator(`foo@npm:5.0.0`),
  structUtils.parseLocator(`foo@npm:6.0.0`),
  structUtils.parseLocator(`foo@npm:7.0.0`),
];

describe(`formatUtils`, () => {
  describe(`prettyTruncatedLocatorList`, () => {
    it(`should return an empty string when the list is empty`, () => {
      expect(formatUtils.prettyTruncatedLocatorList(configuration, [], 100)).toEqual(``);
    });

    it(`should return all locators if possible`, () => {
      expect(formatUtils.prettyTruncatedLocatorList(configuration, LOCATORS, 1000)).toEqual(`foo@npm:1.0.0, foo@npm:2.0.0, foo@npm:3.0.0, foo@npm:4.0.0, foo@npm:5.0.0, foo@npm:6.0.0, foo@npm:7.0.0`);
    });

    it(`should return cut the list of locators if needed`, () => {
      expect(formatUtils.prettyTruncatedLocatorList(configuration, LOCATORS, 100)).toEqual(`foo@npm:1.0.0, foo@npm:2.0.0, foo@npm:3.0.0, foo@npm:4.0.0, foo@npm:5.0.0, and 2 more.`);
    });

    it(`should return cut the list of locators if needed (right on edge)`, () => {
      expect(formatUtils.prettyTruncatedLocatorList(configuration, LOCATORS, 101)).toEqual(`foo@npm:1.0.0, foo@npm:2.0.0, foo@npm:3.0.0, foo@npm:4.0.0, foo@npm:5.0.0, foo@npm:6.0.0, and 1 more.`);
    });
  });
});
