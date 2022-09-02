# esbuild-plugin-pnp

Yarn used to maintain a plugin called [`esbuild-plugin-pnp`](https://yarnpkg.com/package/@yarnpkg/esbuild-plugin-pnp) which added PnP support to Esbuild.

Starting from Esbuild 0.15, this plugin isn't needed anymore and has been deprecated: [Esbuild now implements native support](https://esbuild.github.io/getting-started/#yarn-pnp) for both PnP and zip archives, with much better performances than what the plugin could achieve.
