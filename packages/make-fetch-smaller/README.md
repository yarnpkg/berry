# make-fetch-smaller

This package is a drop-in replacement for `make-fetch-happen`, but uses Node.js native `fetch` instead of pulling [79 dependencies.](https://node-modules.dev/graph#install=make-fetch-happen)

It is used by the [sigstore](https://www.npmjs.com/package/sigstore) package and its dependencies to produce the provenance statement for packages published to the npm registry with `yarn npm publish --provenance`.
