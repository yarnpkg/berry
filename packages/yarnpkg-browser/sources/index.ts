// @ts-ignore
import RawYarnBundle from '@yarnpkg/cli/bundles/yarn.js?raw';

import {Container}   from './Container';

async function main() {
  const container = new Container();
  await container.open();

  await container.reset({
    [`/tmp/temp`]: ``,
    [`/app/sub/package.json`]: `{}`,
    [`/app/package.json`]: `{"dependencies": {"foo": "./sub"}}`,
    [`/yarn.js`]: RawYarnBundle,
  });

  await container.spawn(`/yarn.js`, [`install`], {
    cwd: `/app`,
  });

  const listing = await container.list();
  console.log(listing);
}

main();
