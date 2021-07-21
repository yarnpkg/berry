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
  [`@apollographql/apollo-tools@*`, {
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
  [`fork-ts-checker-webpack-plugin@*`, {
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
  [`react-portal@*`, {
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
  [`gatsby-plugin-sharp@*`, {
    dependencies: {
      [`debug`]: `^4.3.1`,
    },
  }],
  // https://github.com/gatsbyjs/gatsby/pull/28759
  [`gatsby-react-router-scroll@*`, {
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
  [`consolidate@*`, {
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
  [`vue-loader@<=16.3.1`, {
    peerDependencies: {
      '@vue/compiler-sfc': `^3.0.8`,
      webpack: `^4.1.0 || ^5.0.0-0`,
    },
  }],
  // https://github.com/salesforce-ux/scss-parser/pull/43
  [`scss-parser@*`, {
    dependencies: {
      lodash: `^4.17.21`,
    },
  }],
  // https://github.com/salesforce-ux/query-ast/pull/25
  [`query-ast@*`, {
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
];
