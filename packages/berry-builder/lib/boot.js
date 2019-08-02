// TypeScript (ts-loader) isn't able to find out the typeRoots when using zip
// loading (because they're stored within the zip files). So we need to use
// PnPify to help them find them without having to manually list them all in
// the typeRoots setting.
require(`@berry/pnpify/lib`).patchFs();
require(`./cli`);
