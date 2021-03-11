const path = require(`path`);

const TEST_PATHS = [
  `.yarn/$$virtual/@yarnpkg-plugin-npm-virtual-e1403461d9/1/packages/plugin-npm/sources/npmHttpUtils.ts`,
  `.yarn/$$virtual/@yarnpkg-plugin-npm-virtual-e1403461d9/1/packages/plugin-npm/sources/npmHttpUtils.ts:10`,
  `.yarn/$$virtual/@yarnpkg-plugin-npm-virtual-e1403461d9/1/packages/plugin-npm/sources/npmHttpUtils.ts:10:10`,
  `.yarn/$$virtual/@yarnpkg-plugin-npm-virtual-e1403461d9/1/packages/plugin-npm/sources/npmHttpUtils.ts(10,10)`,
  `.yarn/$$virtual/@yarnpkg-plugin-npm-virtual-e1403461d9/1/packages/plugin-npm/sources/npmHttpUtils.ts(40)`,
  `.yarn/__virtual__/@yarnpkg-plugin-npm-virtual-e1403461d9/1/packages/plugin-npm/sources/npmHttpUtils.ts`,
  `.yarn/__virtual__/@yarnpkg-plugin-npm-virtual-e1403461d9/1/packages/plugin-npm/sources/npmHttpUtils.ts:10`,
  `.yarn/__virtual__/@yarnpkg-plugin-npm-virtual-e1403461d9/1/packages/plugin-npm/sources/npmHttpUtils.ts:10:10`,
  `.yarn/__virtual__/@yarnpkg-plugin-npm-virtual-e1403461d9/1/packages/plugin-npm/sources/npmHttpUtils.ts(10,10)`,
  `.yarn/__virtual__/@yarnpkg-plugin-npm-virtual-e1403461d9/1/packages/plugin-npm/sources/npmHttpUtils.ts(40)`,
  `.yarn/cache/@algolia-cache-browser-local-storage-npm-4.2.0-ce650cb25f-654f9bc1af.zip/node_modules/@algolia/cache-browser-local-storage/package.json:10:10`,
];

for (const testFile of TEST_PATHS)
  console.log(`"${path.resolve(__dirname, `../../${testFile}`)}"`);
