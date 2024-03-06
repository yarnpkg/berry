/* eslint-disable @typescript-eslint/naming-convention */

// To extend this list, please open a PR on the relevant repository that adds
// the same fields as you add here and prefix your changes with the relevant
// PR url.

import {PackageExtensionData} from '@yarnpkg/core';

const optionalPeerDep = {
  optional: true,
};

export const packageExtensions: Array<[string, PackageExtensionData]> = [
  // https://github.com/tailwindlabs/tailwindcss-aspect-ratio/pull/14
  [`@tailwindcss/aspect-ratio@<0.2.1`, {
    peerDependencies: {
      [`tailwindcss`]: `^2.0.2`,
    },
  }],
  // https://github.com/tailwindlabs/tailwindcss-line-clamp/pull/6
  [`@tailwindcss/line-clamp@<0.2.1`, {
    peerDependencies: {
      [`tailwindcss`]: `^2.0.2`,
    },
  }],
  // https://github.com/FullHuman/purgecss/commit/24116f394dc54c913e4fd254cf2d78c03db971f2
  [`@fullhuman/postcss-purgecss@3.1.3 || 3.1.3-alpha.0`, {
    peerDependencies: {
      [`postcss`]: `^8.0.0`,
    },
  }],
  // https://github.com/SamVerschueren/stream-to-observable/pull/5
  [`@samverschueren/stream-to-observable@<0.3.1`, {
    peerDependenciesMeta: {
      [`rxjs`]: optionalPeerDep,
      [`zenObservable`]: optionalPeerDep,
    },
  }],
  // https://github.com/sindresorhus/any-observable/pull/25
  [`any-observable@<0.5.1`, {
    peerDependenciesMeta: {
      [`rxjs`]: optionalPeerDep,
      [`zenObservable`]: optionalPeerDep,
    },
  }],
  // https://github.com/keymetrics/pm2-io-agent/pull/125
  [`@pm2/agent@<1.0.4`, {
    dependencies: {
      [`debug`]: `*`,
    },
  }],
  // https://github.com/visionmedia/debug/pull/727
  [`debug@<4.2.0`, {
    peerDependenciesMeta: {
      [`supports-color`]: optionalPeerDep,
    },
  }],
  // https://github.com/sindresorhus/got/pull/1125
  [`got@<11`, {
    dependencies: {
      [`@types/responselike`]: `^1.0.0`,
      [`@types/keyv`]: `^3.1.1`,
    },
  }],
  // https://github.com/szmarczak/cacheable-lookup/pull/12
  [`cacheable-lookup@<4.1.2`, {
    dependencies: {
      [`@types/keyv`]: `^3.1.1`,
    },
  }],
  // https://github.com/prisma-labs/http-link-dataloader/pull/22
  [`http-link-dataloader@*`, {
    peerDependencies: {
      [`graphql`]: `^0.13.1 || ^14.0.0`,
    },
  }],
  // https://github.com/theia-ide/typescript-language-server/issues/144
  [`typescript-language-server@*`, {
    dependencies: {
      [`vscode-jsonrpc`]: `^5.0.1`,
      [`vscode-languageserver-protocol`]: `^3.15.0`,
    },
  }],
  // https://github.com/gucong3000/postcss-syntax/pull/46
  [`postcss-syntax@*`, {
    peerDependenciesMeta: {
      [`postcss-html`]: optionalPeerDep,
      [`postcss-jsx`]: optionalPeerDep,
      [`postcss-less`]: optionalPeerDep,
      [`postcss-markdown`]: optionalPeerDep,
      [`postcss-scss`]: optionalPeerDep,
    },
  }],
  // https://github.com/cssinjs/jss/pull/1315
  [`jss-plugin-rule-value-function@<=10.1.1`, {
    dependencies: {
      [`tiny-warning`]: `^1.0.2`,
    },
  }],
  // https://github.com/vadimdemedes/ink-select-input/pull/26
  [`ink-select-input@<4.1.0`, {
    peerDependencies: {
      react: `^16.8.2`,
    },
  }],
  // https://github.com/xz64/license-webpack-plugin/pull/100
  [`license-webpack-plugin@<2.3.18`, {
    peerDependenciesMeta: {
      [`webpack`]: optionalPeerDep,
    },
  }],
  // https://github.com/snowpackjs/snowpack/issues/3158
  [`snowpack@>=3.3.0`, {
    dependencies: {
      [`node-gyp`]: `^7.1.0`,
    },
  }],
  // https://github.com/iarna/promise-inflight/pull/4
  [`promise-inflight@*`, {
    peerDependenciesMeta: {
      [`bluebird`]: optionalPeerDep,
    },
  }],
  // https://github.com/casesandberg/reactcss/pull/153
  [`reactcss@*`, {
    peerDependencies: {
      react: `*`,
    },
  }],
  // https://github.com/casesandberg/react-color/pull/746
  [`react-color@<=2.19.0`, {
    peerDependencies: {
      react: `*`,
    },
  }],
  // https://github.com/angeloocana/gatsby-plugin-i18n/pull/145
  [`gatsby-plugin-i18n@*`, {
    dependencies: {
      ramda: `^0.24.1`,
    },
  }],
  // https://github.com/3rd-Eden/useragent/pull/159
  [`useragent@^2.0.0`, {
    dependencies: {
      request: `^2.88.0`,
      yamlparser: `0.0.x`,
      semver: `5.5.x`,
    },
  }],
  // https://github.com/apollographql/apollo-tooling/pull/2049
  [`@apollographql/apollo-tools@<=0.5.2`, {
    peerDependencies: {
      graphql: `^14.2.1 || ^15.0.0`,
    },
  }],
  // https://github.com/mbrn/material-table/pull/2374
  [`material-table@^2.0.0`, {
    dependencies: {
      "@babel/runtime": `^7.11.2`,
    },
  }],
  // https://github.com/babel/babel/pull/11118
  [`@babel/parser@*`, {
    dependencies: {
      "@babel/types": `^7.8.3`,
    },
  }],
  // https://github.com/TypeStrong/fork-ts-checker-webpack-plugin/pull/507
  [`fork-ts-checker-webpack-plugin@<=6.3.4`, {
    peerDependencies: {
      eslint: `>= 6`,
      typescript: `>= 2.7`,
      webpack: `>= 4`,
      'vue-template-compiler': `*`,
    },
    peerDependenciesMeta: {
      eslint: optionalPeerDep,
      'vue-template-compiler': optionalPeerDep,
    },
  }],
  // https://github.com/react-component/animate/pull/116
  [`rc-animate@<=3.1.1`, {
    peerDependencies: {
      react: `>=16.9.0`,
      'react-dom': `>=16.9.0`,
    },
  }],
  // https://github.com/react-bootstrap-table/react-bootstrap-table2/pull/1491
  [`react-bootstrap-table2-paginator@*`, {
    dependencies: {
      classnames: `^2.2.6`,
    },
  }],
  // https://github.com/STRML/react-draggable/pull/525
  [`react-draggable@<=4.4.3`, {
    peerDependencies: {
      react: `>= 16.3.0`,
      'react-dom': `>= 16.3.0`,
    },
  }],
  // https://github.com/jaydenseric/apollo-upload-client/commit/336691cec6698661ab404649e4e8435750255803
  [`apollo-upload-client@<14`, {
    peerDependencies: {
      graphql: `14 - 15`,
    },
  }],
  // https://github.com/algolia/react-instantsearch/pull/2975
  [`react-instantsearch-core@<=6.7.0`, {
    peerDependencies: {
      algoliasearch: `>= 3.1 < 5`,
    },
  }],
  // https://github.com/algolia/react-instantsearch/pull/2975
  [`react-instantsearch-dom@<=6.7.0`, {
    dependencies: {
      'react-fast-compare': `^3.0.0`,
    },
  }],
  // https://github.com/websockets/ws/pull/1626
  [`ws@<7.2.1`, {
    peerDependencies: {
      bufferutil: `^4.0.1`,
      'utf-8-validate': `^5.0.2`,
    },
    peerDependenciesMeta: {
      bufferutil: optionalPeerDep,
      'utf-8-validate': optionalPeerDep,
    },
  }],
  // https://github.com/tajo/react-portal/pull/233
  // https://github.com/tajo/react-portal/commit/daf85792c2fce25a3481b6f9132ef61a110f3d78
  [`react-portal@<4.2.2`, {
    peerDependencies: {
      'react-dom': `^15.0.0-0 || ^16.0.0-0 || ^17.0.0-0`,
    },
  }],
  // https://github.com/facebook/create-react-app/pull/9872
  [`react-scripts@<=4.0.1`, {
    peerDependencies: {
      [`react`]: `*`,
    },
  }],
  // https://github.com/DevExpress/testcafe/pull/5872
  [`testcafe@<=1.10.1`, {
    dependencies: {
      '@babel/plugin-transform-for-of': `^7.12.1`,
      '@babel/runtime': `^7.12.5`,
    },
  }],
  // https://github.com/DevExpress/testcafe-legacy-api/pull/51
  [`testcafe-legacy-api@<=4.2.0`, {
    dependencies: {
      'testcafe-hammerhead': `^17.0.1`,
      'read-file-relative': `^1.2.0`,
    },
  }],
  // https://github.com/googleapis/nodejs-firestore/pull/1425
  [`@google-cloud/firestore@<=4.9.3`, {
    dependencies: {
      protobufjs: `^6.8.6`,
    },
  }],
  // https://github.com/thinhle-agilityio/gatsby-source-apiserver/pull/58
  [`gatsby-source-apiserver@*`, {
    dependencies: {
      [`babel-polyfill`]: `^6.26.0`,
    },
  }],
  // https://github.com/webpack/webpack-cli/pull/2097
  [`@webpack-cli/package-utils@<=1.0.1-alpha.4`, {
    dependencies: {
      [`cross-spawn`]: `^7.0.3`,
    },
  }],
  // https://github.com/gatsbyjs/gatsby/pull/20156
  [`gatsby-remark-prismjs@<3.3.28`, {
    dependencies: {
      [`lodash`]: `^4`,
    },
  }],
  // https://github.com/Creatiwity/gatsby-plugin-favicon/pull/65
  [`gatsby-plugin-favicon@*`, {
    peerDependencies: {
      [`webpack`]: `*`,
    },
  }],
  // https://github.com/gatsbyjs/gatsby/pull/28759
  [`gatsby-plugin-sharp@<=4.6.0-next.3`, {
    dependencies: {
      [`debug`]: `^4.3.1`,
    },
  }],
  // https://github.com/gatsbyjs/gatsby/pull/28759
  [`gatsby-react-router-scroll@<=5.6.0-next.0`, {
    dependencies: {
      [`prop-types`]: `^15.7.2`,
    },
  }],
  // https://github.com/rebassjs/rebass/pull/934
  [`@rebass/forms@*`, {
    dependencies: {
      [`@styled-system/should-forward-prop`]: `^5.0.0`,
    },
    peerDependencies: {
      react: `^16.8.6`,
    },
  }],
  // https://github.com/rebassjs/rebass/pull/934
  [`rebass@*`, {
    peerDependencies: {
      react: `^16.8.6`,
    },
  }],
  // https://github.com/ant-design/react-slick/pull/95
  [`@ant-design/react-slick@<=0.28.3`, {
    peerDependencies: {
      react: `>=16.0.0`,
    },
  }],
  // https://github.com/mqttjs/MQTT.js/pull/1266
  [`mqtt@<4.2.7`, {
    dependencies: {
      duplexify: `^4.1.1`,
    },
  }],
  // https://github.com/vuetifyjs/vue-cli-plugins/pull/155
  [`vue-cli-plugin-vuetify@<=2.0.3`, {
    dependencies: {
      semver: `^6.3.0`,
    },
    peerDependenciesMeta: {
      'sass-loader': optionalPeerDep,
      'vuetify-loader': optionalPeerDep,
    },
  }],
  // https://github.com/vuetifyjs/vue-cli-plugins/pull/152
  [`vue-cli-plugin-vuetify@<=2.0.4`, {
    dependencies: {
      'null-loader': `^3.0.0`,
    },
  }],
  // https://github.com/vuetifyjs/vue-cli-plugins/pull/324
  [`vue-cli-plugin-vuetify@>=2.4.3`, {
    peerDependencies: {
      vue: `*`,
    },
  }],
  // https://github.com/vuetifyjs/vue-cli-plugins/pull/155
  [`@vuetify/cli-plugin-utils@<=0.0.4`, {
    dependencies: {
      semver: `^6.3.0`,
    },
    peerDependenciesMeta: {
      'sass-loader': optionalPeerDep,
    },
  }],
  // https://github.com/vuejs/vue-cli/pull/6060/files#diff-857cfb6f3e9a676b0de4a00c2c712297068c038a7d5820c133b8d6aa8cceb146R28
  [`@vue/cli-plugin-typescript@<=5.0.0-alpha.0`, {
    dependencies: {
      'babel-loader': `^8.1.0`,
    },
  }],
  // https://github.com/vuejs/vue-cli/pull/6456
  [`@vue/cli-plugin-typescript@<=5.0.0-beta.0`, {
    dependencies: {
      '@babel/core': `^7.12.16`,
    },
    peerDependencies: {
      'vue-template-compiler': `^2.0.0`,
    },
    peerDependenciesMeta: {
      'vue-template-compiler': optionalPeerDep,
    },
  }],
  // https://github.com/apache/cordova-ios/pull/1105
  [`cordova-ios@<=6.3.0`, {
    dependencies: {
      underscore: `^1.9.2`,
    },
  }],
  // https://github.com/apache/cordova-lib/pull/871
  [`cordova-lib@<=10.0.1`, {
    dependencies: {
      underscore: `^1.9.2`,
    },
  }],
  // https://github.com/creationix/git-node-fs/pull/8
  [`git-node-fs@*`, {
    peerDependencies: {
      'js-git': `^0.7.8`,
    },
    peerDependenciesMeta: {
      'js-git': optionalPeerDep,
    },
  }],
  // https://github.com/tj/consolidate.js/pull/339
  // https://github.com/tj/consolidate.js/commit/6068c17fd443897e540d69b1786db07a0d64b53b
  [`consolidate@<0.16.0`, {
    peerDependencies: {
      mustache: `^3.0.0`,
    },
    peerDependenciesMeta: {
      mustache: optionalPeerDep,
    },
  }],
  // https://github.com/tj/consolidate.js/pull/339
  [`consolidate@<=0.16.0`, {
    peerDependencies: {
      velocityjs: `^2.0.1`,
      tinyliquid: `^0.2.34`,
      'liquid-node': `^3.0.1`,
      jade: `^1.11.0`,
      'then-jade': `*`,
      dust: `^0.3.0`,
      'dustjs-helpers': `^1.7.4`,
      'dustjs-linkedin': `^2.7.5`,
      swig: `^1.4.2`,
      'swig-templates': `^2.0.3`,
      'razor-tmpl': `^1.3.1`,
      atpl: `>=0.7.6`,
      liquor: `^0.0.5`,
      twig: `^1.15.2`,
      ejs: `^3.1.5`,
      eco: `^1.1.0-rc-3`,
      jazz: `^0.0.18`,
      jqtpl: `~1.1.0`,
      hamljs: `^0.6.2`,
      hamlet: `^0.3.3`,
      whiskers: `^0.4.0`,
      'haml-coffee': `^1.14.1`,
      'hogan.js': `^3.0.2`,
      templayed: `>=0.2.3`,
      handlebars: `^4.7.6`,
      underscore: `^1.11.0`,
      lodash: `^4.17.20`,
      pug: `^3.0.0`,
      'then-pug': `*`,
      qejs: `^3.0.5`,
      walrus: `^0.10.1`,
      mustache: `^4.0.1`,
      just: `^0.1.8`,
      ect: `^0.5.9`,
      mote: `^0.2.0`,
      toffee: `^0.3.6`,
      dot: `^1.1.3`,
      'bracket-template': `^1.1.5`,
      ractive: `^1.3.12`,
      nunjucks: `^3.2.2`,
      htmling: `^0.0.8`,
      'babel-core': `^6.26.3`,
      plates: `~0.4.11`,
      'react-dom': `^16.13.1`,
      react: `^16.13.1`,
      'arc-templates': `^0.5.3`,
      vash: `^0.13.0`,
      slm: `^2.0.0`,
      marko: `^3.14.4`,
      teacup: `^2.0.0`,
      'coffee-script': `^1.12.7`,
      squirrelly: `^5.1.0`,
      twing: `^5.0.2`,
    },
    peerDependenciesMeta: {
      velocityjs: optionalPeerDep,
      tinyliquid: optionalPeerDep,
      'liquid-node': optionalPeerDep,
      jade: optionalPeerDep,
      'then-jade': optionalPeerDep,
      dust: optionalPeerDep,
      'dustjs-helpers': optionalPeerDep,
      'dustjs-linkedin': optionalPeerDep,
      swig: optionalPeerDep,
      'swig-templates': optionalPeerDep,
      'razor-tmpl': optionalPeerDep,
      atpl: optionalPeerDep,
      liquor: optionalPeerDep,
      twig: optionalPeerDep,
      ejs: optionalPeerDep,
      eco: optionalPeerDep,
      jazz: optionalPeerDep,
      jqtpl: optionalPeerDep,
      hamljs: optionalPeerDep,
      hamlet: optionalPeerDep,
      whiskers: optionalPeerDep,
      'haml-coffee': optionalPeerDep,
      'hogan.js': optionalPeerDep,
      templayed: optionalPeerDep,
      handlebars: optionalPeerDep,
      underscore: optionalPeerDep,
      lodash: optionalPeerDep,
      pug: optionalPeerDep,
      'then-pug': optionalPeerDep,
      qejs: optionalPeerDep,
      walrus: optionalPeerDep,
      mustache: optionalPeerDep,
      just: optionalPeerDep,
      ect: optionalPeerDep,
      mote: optionalPeerDep,
      toffee: optionalPeerDep,
      dot: optionalPeerDep,
      'bracket-template': optionalPeerDep,
      ractive: optionalPeerDep,
      nunjucks: optionalPeerDep,
      htmling: optionalPeerDep,
      'babel-core': optionalPeerDep,
      plates: optionalPeerDep,
      'react-dom': optionalPeerDep,
      react: optionalPeerDep,
      'arc-templates': optionalPeerDep,
      vash: optionalPeerDep,
      slm: optionalPeerDep,
      marko: optionalPeerDep,
      teacup: optionalPeerDep,
      'coffee-script': optionalPeerDep,
      squirrelly: optionalPeerDep,
      twing: optionalPeerDep,
    },
  }],
  // https://github.com/vuejs/vue-loader/pull/1853
  // https://github.com/vuejs/vue-loader/commit/089473af97077b8e14b3feff48d32d2733ad792c
  [`vue-loader@<=16.3.3`, {
    peerDependencies: {
      '@vue/compiler-sfc': `^3.0.8`,
      webpack: `^4.1.0 || ^5.0.0-0`,
    },
    peerDependenciesMeta: {
      '@vue/compiler-sfc': optionalPeerDep,
    },
  }],
  // https://github.com/vuejs/vue-loader/pull/1944
  [`vue-loader@^16.7.0`, {
    peerDependencies: {
      '@vue/compiler-sfc': `^3.0.8`,
      vue: `^3.2.13`,
    },
    peerDependenciesMeta: {
      '@vue/compiler-sfc': optionalPeerDep,
      vue: optionalPeerDep,
    },
  }],
  // https://github.com/salesforce-ux/scss-parser/pull/43
  [`scss-parser@<=1.0.5`, {
    dependencies: {
      lodash: `^4.17.21`,
    },
  }],
  // https://github.com/salesforce-ux/query-ast/pull/25
  [`query-ast@<1.0.5`, {
    dependencies: {
      lodash: `^4.17.21`,
    },
  }],
  // https://github.com/reduxjs/redux-thunk/pull/251
  [`redux-thunk@<=2.3.0`, {
    peerDependencies: {
      redux: `^4.0.0`,
    },
  }],
  // https://github.com/snowpackjs/snowpack/pull/3556
  [`skypack@<=0.3.2`, {
    dependencies: {
      tar: `^6.1.0`,
    },
  }],
  // https://github.com/npm/metavuln-calculator/pull/8
  [`@npmcli/metavuln-calculator@<2.0.0`, {
    dependencies: {
      'json-parse-even-better-errors': `^2.3.1`,
    },
  }],
  // https://github.com/npm/bin-links/pull/17
  [`bin-links@<2.3.0`, {
    dependencies: {
      'mkdirp-infer-owner': `^1.0.2`,
    },
  }],
  // https://github.com/snowpackjs/rollup-plugin-polyfill-node/pull/30
  [`rollup-plugin-polyfill-node@<=0.8.0`, {
    peerDependencies: {
      rollup: `^1.20.0 || ^2.0.0`,
    },
  }],
  // https://github.com/snowpackjs/snowpack/pull/3673
  [`snowpack@<3.8.6`, {
    dependencies: {
      'magic-string': `^0.25.7`,
    },
  }],
  // https://github.com/elm-community/elm-webpack-loader/pull/202
  [`elm-webpack-loader@*`, {
    dependencies: {
      temp: `^0.9.4`,
    },
  }],
  // https://github.com/winstonjs/winston-transport/pull/58
  [`winston-transport@<=4.4.0`, {
    dependencies: {
      logform: `^2.2.0`,
    },
  }],
  // https://github.com/vire/jest-vue-preprocessor/pull/177
  [`jest-vue-preprocessor@*`, {
    dependencies: {
      '@babel/core': `7.8.7`,
      '@babel/template': `7.8.6`,
    },
    peerDependencies: {
      pug: `^2.0.4`,
    },
    peerDependenciesMeta: {
      pug: optionalPeerDep,
    },
  }],
  // https://github.com/rt2zz/redux-persist/pull/1336
  [`redux-persist@*`, {
    peerDependencies: {
      react: `>=16`,
    },
    peerDependenciesMeta: {
      react: optionalPeerDep,
    },
  }],
  // https://github.com/paixaop/node-sodium/pull/159
  [`sodium@>=3`, {
    dependencies: {
      'node-gyp': `^3.8.0`,
    },
  }],
  // https://github.com/gajus/babel-plugin-graphql-tag/pull/63
  [`babel-plugin-graphql-tag@<=3.1.0`, {
    peerDependencies: {
      graphql: `^14.0.0 || ^15.0.0`,
    },
  }],
  // https://github.com/microsoft/playwright/pull/8501
  [`@playwright/test@<=1.14.1`, {
    dependencies: {
      'jest-matcher-utils': `^26.4.2`,
    },
  }],
  // https://github.com/gatsbyjs/gatsby/pull/32954
  ...[
    `babel-plugin-remove-graphql-queries@<3.14.0-next.1`,
    `babel-preset-gatsby-package@<1.14.0-next.1`,
    `create-gatsby@<1.14.0-next.1`,
    `gatsby-admin@<0.24.0-next.1`,
    `gatsby-cli@<3.14.0-next.1`,
    `gatsby-core-utils@<2.14.0-next.1`,
    `gatsby-design-tokens@<3.14.0-next.1`,
    `gatsby-legacy-polyfills@<1.14.0-next.1`,
    `gatsby-plugin-benchmark-reporting@<1.14.0-next.1`,
    `gatsby-plugin-graphql-config@<0.23.0-next.1`,
    `gatsby-plugin-image@<1.14.0-next.1`,
    `gatsby-plugin-mdx@<2.14.0-next.1`,
    `gatsby-plugin-netlify-cms@<5.14.0-next.1`,
    `gatsby-plugin-no-sourcemaps@<3.14.0-next.1`,
    `gatsby-plugin-page-creator@<3.14.0-next.1`,
    `gatsby-plugin-preact@<5.14.0-next.1`,
    `gatsby-plugin-preload-fonts@<2.14.0-next.1`,
    `gatsby-plugin-schema-snapshot@<2.14.0-next.1`,
    `gatsby-plugin-styletron@<6.14.0-next.1`,
    `gatsby-plugin-subfont@<3.14.0-next.1`,
    `gatsby-plugin-utils@<1.14.0-next.1`,
    `gatsby-recipes@<0.25.0-next.1`,
    `gatsby-source-shopify@<5.6.0-next.1`,
    `gatsby-source-wikipedia@<3.14.0-next.1`,
    `gatsby-transformer-screenshot@<3.14.0-next.1`,
    `gatsby-worker@<0.5.0-next.1`,
  ].map<[string, PackageExtensionData]>(descriptorString => [
    descriptorString,
    {
      dependencies: {
        '@babel/runtime': `^7.14.8`,
      },
    },
  ]),
  // Originally fixed in https://github.com/gatsbyjs/gatsby/pull/31837 (https://github.com/gatsbyjs/gatsby/commit/6378692d7ec1eb902520720e27aca97e8eb42c21)
  // Version updated and added in https://github.com/gatsbyjs/gatsby/pull/32928
  [`gatsby-core-utils@<2.14.0-next.1`, {
    dependencies: {
      got: `8.3.2`,
    },
  }],
  // https://github.com/gatsbyjs/gatsby/pull/32861
  [`gatsby-plugin-gatsby-cloud@<=3.1.0-next.0`, {
    dependencies: {
      'gatsby-core-utils': `^2.13.0-next.0`,
    },
  }],
  // https://github.com/gatsbyjs/gatsby/pull/31837
  [`gatsby-plugin-gatsby-cloud@<=3.2.0-next.1`, {
    peerDependencies: {
      webpack: `*`,
    },
  }],
  // https://github.com/gatsbyjs/gatsby/pull/31837
  [`babel-plugin-remove-graphql-queries@<=3.14.0-next.1`, {
    dependencies: {
      'gatsby-core-utils': `^2.8.0-next.1`,
    },
  }],
  // https://github.com/gatsbyjs/gatsby/pull/32861
  [`gatsby-plugin-netlify@3.13.0-next.1`, {
    dependencies: {
      'gatsby-core-utils': `^2.13.0-next.0`,
    },
  }],
  // https://github.com/paul-soporan/clipanion-v3-codemod/pull/1
  [`clipanion-v3-codemod@<=0.2.0`, {
    peerDependencies: {
      jscodeshift: `^0.11.0`,
    },
  }],
  // https://github.com/FormidableLabs/react-live/pull/180
  [`react-live@*`, {
    peerDependencies: {
      'react-dom': `*`,
      react: `*`,
    },
  }],
  // https://github.com/webpack/webpack/pull/11190
  [`webpack@<4.44.1`, {
    peerDependenciesMeta: {
      'webpack-cli': optionalPeerDep,
      'webpack-command': optionalPeerDep,
    },
  }],
  // https://github.com/webpack/webpack/pull/11189
  [`webpack@<5.0.0-beta.23`, {
    peerDependenciesMeta: {
      'webpack-cli': optionalPeerDep,
    },
  }],
  // https://github.com/webpack/webpack-dev-server/pull/2396
  [`webpack-dev-server@<3.10.2`, {
    peerDependenciesMeta: {
      'webpack-cli': optionalPeerDep,
    },
  }],
  // https://github.com/slorber/responsive-loader/pull/1/files
  [`@docusaurus/responsive-loader@<1.5.0`, {
    peerDependenciesMeta: {
      sharp: optionalPeerDep,
      jimp: optionalPeerDep,
    },
  }],
  // https://github.com/import-js/eslint-plugin-import/pull/2283
  [`eslint-module-utils@*`, {
    peerDependenciesMeta: {
      'eslint-import-resolver-node': optionalPeerDep,
      'eslint-import-resolver-typescript': optionalPeerDep,
      'eslint-import-resolver-webpack': optionalPeerDep,
      '@typescript-eslint/parser': optionalPeerDep,
    },
  }],
  // https://github.com/import-js/eslint-plugin-import/pull/2283
  [`eslint-plugin-import@*`, {
    peerDependenciesMeta: {
      '@typescript-eslint/parser': optionalPeerDep,
    },
  }],
  // https://github.com/GoogleChromeLabs/critters/pull/91
  [`critters-webpack-plugin@<3.0.2`, {
    peerDependenciesMeta: {
      'html-webpack-plugin': optionalPeerDep,
    },
  }],
  // https://github.com/terser/terser/commit/05b23eeb682d732484ad51b19bf528258fd5dc2a
  [`terser@<=5.10.0`, {
    dependencies: {
      acorn: `^8.5.0`,
    },
  }],
  // https://github.com/facebook/create-react-app/pull/12364
  [`babel-preset-react-app@10.0.x <10.0.2`, {
    dependencies: {
      '@babel/plugin-proposal-private-property-in-object': `^7.16.7`,
    },
  }],
  // https://github.com/facebook/create-react-app/pull/11751
  [`eslint-config-react-app@*`, {
    peerDependenciesMeta: {
      typescript: optionalPeerDep,
    },
  }],
  // https://github.com/vuejs/eslint-config-typescript/pull/39
  [`@vue/eslint-config-typescript@<11.0.0`, {
    peerDependenciesMeta: {
      typescript: optionalPeerDep,
    },
  }],
  // https://github.com/antfu/unplugin-vue2-script-setup/pull/100
  [`unplugin-vue2-script-setup@<0.9.1`, {
    peerDependencies: {
      '@vue/composition-api': `^1.4.3`,
      '@vue/runtime-dom': `^3.2.26`,
    },
  }],
  // https://github.com/cypress-io/snapshot/pull/159
  [`@cypress/snapshot@*`, {
    dependencies: {
      debug: `^3.2.7`,
    },
  }],
  // https://github.com/wemaintain/auto-relay/pull/95
  [`auto-relay@<=0.14.0`, {
    peerDependencies: {
      'reflect-metadata': `^0.1.13`,
    },
  }],
  // https://github.com/JuniorTour/vue-template-babel-compiler/pull/40
  [`vue-template-babel-compiler@<1.2.0`, {
    peerDependencies: {
      [`vue-template-compiler`]: `^2.6.0`,
    },
  }],
  // https://github.com/parcel-bundler/parcel/pull/7977
  [`@parcel/transformer-image@<2.5.0`, {
    peerDependencies: {
      [`@parcel/core`]: `*`,
    },
  }],
  // https://github.com/parcel-bundler/parcel/pull/7977
  [`@parcel/transformer-js@<2.5.0`, {
    peerDependencies: {
      [`@parcel/core`]: `*`,
    },
  }],
  // Experiment to unblock the usage of Parcel in E2E tests
  [`parcel@*`, {
    peerDependenciesMeta: {
      [`@parcel/core`]: optionalPeerDep,
    },
  }],
  // This doesn't have an upstream PR.
  // The auto types causes two instances of eslint-config-react-app,
  // one that has access to @types/eslint and one that doesn't.
  // ESLint doesn't allow the same plugin to show up multiple times so it throws.
  // As a temporary workaround until create-react-app fixes their ESLint
  // setup we make eslint a peer dependency /w fallback.
  // TODO: Lock the range when create-react-app fixes their ESLint setup
  [`react-scripts@*`, {
    peerDependencies: {
      [`eslint`]: `*`,
    },
  }],
  // https://github.com/focus-trap/focus-trap-react/pull/691
  [`focus-trap-react@^8.0.0`, {
    dependencies: {
      tabbable: `^5.3.2`,
    },
  }],
  // https://github.com/bokuweb/react-rnd/pull/864
  [`react-rnd@<10.3.7`, {
    peerDependencies: {
      react: `>=16.3.0`,
      'react-dom': `>=16.3.0`,
    },
  }],
  // https://github.com/jdesboeufs/connect-mongo/pull/458
  // https://github.com/jdesboeufs/connect-mongo/commit/f462a2598d1dea0722a89e1f101937d427462458
  [`connect-mongo@<5.0.0`, {
    peerDependencies: {
      'express-session': `^1.17.1`,
    },
  }],
  // https://github.com/intlify/vue-i18n-next/commit/ed932b9e575807dc27c30573b280ad8ae48e98c9
  [`vue-i18n@<9`, {
    peerDependencies: {
      vue: `^2`,
    },
  }],
  // https://github.com/vuejs/router/commit/c2305083a8fcb42d1bb1f3f0d92f09930124b530
  [`vue-router@<4`, {
    peerDependencies: {
      vue: `^2`,
    },
  }],
  // https://github.com/unifiedjs/unified/pull/146
  [`unified@<10`, {
    dependencies: {
      '@types/unist': `^2.0.0`,
    },
  }],
  // https://github.com/ntkme/react-github-btn/pull/23
  [`react-github-btn@<=1.3.0`, {
    peerDependencies: {
      react: `>=16.3.0`,
    },
  }],
  // There are two candidates upstream, clean this up when either is merged.
  // - https://github.com/facebook/create-react-app/pull/11526
  // - https://github.com/facebook/create-react-app/pull/11716
  [`react-dev-utils@*`, {
    peerDependencies: {
      typescript: `>=2.7`,
      webpack: `>=4`,
    },
    peerDependenciesMeta: {
      typescript: optionalPeerDep,
    },
  }],
  // https://github.com/asyncapi/asyncapi-react/pull/614
  [`@asyncapi/react-component@<=1.0.0-next.39`, {
    peerDependencies: {
      react: `>=16.8.0`,
      'react-dom': `>=16.8.0`,
    },
  }],
  // https://github.com/xojs/xo/pull/678
  [`xo@*`, {
    peerDependencies: {
      webpack: `>=1.11.0`,
    },
    peerDependenciesMeta: {
      webpack: optionalPeerDep,
    },
  }],
  // https://github.com/gatsbyjs/gatsby/pull/36230
  [`babel-plugin-remove-graphql-queries@<=4.20.0-next.0`, {
    dependencies: {
      '@babel/types': `^7.15.4`,
    },
  }],
  // https://github.com/gatsbyjs/gatsby/pull/36230
  [`gatsby-plugin-page-creator@<=4.20.0-next.1`, {
    dependencies: {
      'fs-extra': `^10.1.0`,
    },
  }],
  // https://github.com/gatsbyjs/gatsby/pull/36230
  [`gatsby-plugin-utils@<=3.14.0-next.1`, {
    dependencies: {
      fastq: `^1.13.0`,
    },
    peerDependencies: {
      graphql: `^15.0.0`,
    },
  }],
  // https://github.com/gatsbyjs/gatsby/pull/33724
  [`gatsby-plugin-mdx@<3.1.0-next.1`, {
    dependencies: {
      mkdirp: `^1.0.4`,
    },
  }],
  // https://github.com/gatsbyjs/gatsby/pull/33170
  [`gatsby-plugin-mdx@^2`, {
    peerDependencies: {
      gatsby: `^3.0.0-next`,
    },
  }],
  // https://github.com/thecodrr/fdir/pull/76
  // https://github.com/thecodrr/fdir/pull/80
  [`fdir@<=5.2.0`, {
    peerDependencies: {
      picomatch: `2.x`,
    },
    peerDependenciesMeta: {
      picomatch: optionalPeerDep,
    },
  }],
  // https://github.com/leonardfactory/babel-plugin-transform-typescript-metadata/pull/61
  [`babel-plugin-transform-typescript-metadata@<=0.3.2`, {
    peerDependencies: {
      "@babel/core": `^7`,
      "@babel/traverse": `^7`,
    },
    peerDependenciesMeta: {
      "@babel/traverse": optionalPeerDep,
    },
  }],
  // https://github.com/graphql-compose/graphql-compose/pull/398
  [`graphql-compose@>=9.0.10`, {
    peerDependencies: {
      graphql: `^14.2.0 || ^15.0.0 || ^16.0.0`,
    },
  }],
  // https://github.com/vuetifyjs/vuetify-loader/commit/6634db3218dcc706db1c5c9e90f338ce76e9fff3
  [`vite-plugin-vuetify@<=1.0.2`, {
    peerDependencies: {
      vue: `^3.0.0`,
    },
  }],
  // https://github.com/vuetifyjs/vuetify-loader/commit/6634db3218dcc706db1c5c9e90f338ce76e9fff3
  [`webpack-plugin-vuetify@<=2.0.1`, {
    peerDependencies: {
      vue: `^3.2.6`,
    },
  }],
  // https://github.com/pzmosquito/eslint-import-resolver-vite/pull/22
  // https://github.com/pzmosquito/eslint-import-resolver-vite/commit/97b8111b03d3f8c66506732ac965e906568e8dc1#diff-7ae45ad102eab3b6d7e7896acd08c427a9b25b346470d7bc6507b6481575d519
  [`eslint-import-resolver-vite@<2.0.1`, {
    dependencies: {
      debug: `^4.3.4`,
      resolve: `^1.22.8`,
    },
  }],
];
