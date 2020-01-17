/* eslint-disable*/
module.exports = {
  name: "@yarnpkg/plugin-typescript",
  factory: function (require) {
                          var plugin =
  /******/ (function(modules) { // webpackBootstrap
  /******/ 	// The module cache
  /******/ 	var installedModules = {};
  /******/
  /******/ 	// The require function
  /******/ 	function __webpack_require__(moduleId) {
  /******/
  /******/ 		// Check if module is in cache
  /******/ 		if(installedModules[moduleId]) {
  /******/ 			return installedModules[moduleId].exports;
  /******/ 		}
  /******/ 		// Create a new module (and put it into the cache)
  /******/ 		var module = installedModules[moduleId] = {
  /******/ 			i: moduleId,
  /******/ 			l: false,
  /******/ 			exports: {}
  /******/ 		};
  /******/
  /******/ 		// Execute the module function
  /******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
  /******/
  /******/ 		// Flag the module as loaded
  /******/ 		module.l = true;
  /******/
  /******/ 		// Return the exports of the module
  /******/ 		return module.exports;
  /******/ 	}
  /******/
  /******/
  /******/ 	// expose the modules object (__webpack_modules__)
  /******/ 	__webpack_require__.m = modules;
  /******/
  /******/ 	// expose the module cache
  /******/ 	__webpack_require__.c = installedModules;
  /******/
  /******/ 	// define getter function for harmony exports
  /******/ 	__webpack_require__.d = function(exports, name, getter) {
  /******/ 		if(!__webpack_require__.o(exports, name)) {
  /******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
  /******/ 		}
  /******/ 	};
  /******/
  /******/ 	// define __esModule on exports
  /******/ 	__webpack_require__.r = function(exports) {
  /******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
  /******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
  /******/ 		}
  /******/ 		Object.defineProperty(exports, '__esModule', { value: true });
  /******/ 	};
  /******/
  /******/ 	// create a fake namespace object
  /******/ 	// mode & 1: value is a module id, require it
  /******/ 	// mode & 2: merge all properties of value into the ns
  /******/ 	// mode & 4: return value when already ns object
  /******/ 	// mode & 8|1: behave like require
  /******/ 	__webpack_require__.t = function(value, mode) {
  /******/ 		if(mode & 1) value = __webpack_require__(value);
  /******/ 		if(mode & 8) return value;
  /******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
  /******/ 		var ns = Object.create(null);
  /******/ 		__webpack_require__.r(ns);
  /******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
  /******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
  /******/ 		return ns;
  /******/ 	};
  /******/
  /******/ 	// getDefaultExport function for compatibility with non-harmony modules
  /******/ 	__webpack_require__.n = function(module) {
  /******/ 		var getter = module && module.__esModule ?
  /******/ 			function getDefault() { return module['default']; } :
  /******/ 			function getModuleExports() { return module; };
  /******/ 		__webpack_require__.d(getter, 'a', getter);
  /******/ 		return getter;
  /******/ 	};
  /******/
  /******/ 	// Object.prototype.hasOwnProperty.call
  /******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
  /******/
  /******/ 	// __webpack_public_path__
  /******/ 	__webpack_require__.p = "";
  /******/
  /******/
  /******/ 	// Load entry module and return exports
  /******/ 	return __webpack_require__(__webpack_require__.s = 0);
  /******/ })
  /************************************************************************/
  /******/ ([
  /* 0 */
  /***/ (function(module, exports, __webpack_require__) {

  "use strict";


  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  const core_1 = __webpack_require__(1);

  const core_2 = __webpack_require__(1);

  const plugin_essentials_1 = __webpack_require__(2);

  const typescriptUtils_1 = __webpack_require__(3);

  const getTypesName = descriptor => {
    return descriptor.scope ? `${descriptor.scope}__${descriptor.name}` : `${descriptor.name}`;
  };

  const afterWorkspaceDependencyAddition = async (workspace, dependencyTarget, descriptor) => {
    if (descriptor.scope === `types`) return;
    const project = workspace.project;
    const configuration = project.configuration;
    const requiresInstallTypes = await typescriptUtils_1.hasDefinitelyTyped(descriptor, configuration);
    if (!requiresInstallTypes) return;
    const cache = await core_1.Cache.find(configuration);
    const typesName = getTypesName(descriptor);
    const target = plugin_essentials_1.suggestUtils.Target.DEVELOPMENT;
    const modifier = plugin_essentials_1.suggestUtils.Modifier.EXACT;
    const strategies = [plugin_essentials_1.suggestUtils.Strategy.LATEST];
    const request = core_2.structUtils.makeDescriptor(core_2.structUtils.makeIdent(`types`, typesName), `unknown`);
    const suggestions = await plugin_essentials_1.suggestUtils.getSuggestedDescriptors(request, {
      workspace,
      project,
      cache,
      target,
      modifier,
      strategies
    });
    const nonNullSuggestions = suggestions.filter(suggestion => suggestion.descriptor !== null);
    if (nonNullSuggestions.length === 0) return;
    const selected = nonNullSuggestions[0].descriptor;
    if (selected === null) return;
    workspace.manifest[target].set(selected.identHash, selected);
  };

  const afterWorkspaceDependencyRemoval = async (workspace, dependencyTarget, descriptor) => {
    if (descriptor.scope === `types`) return;
    const target = plugin_essentials_1.suggestUtils.Target.DEVELOPMENT;
    const typesName = getTypesName(descriptor);
    const ident = core_2.structUtils.makeIdent(`types`, typesName);
    const current = workspace.manifest[target].get(ident.identHash);
    if (typeof current === `undefined`) return;
    workspace.manifest[target].delete(ident.identHash);
  };

  const beforeWorkspacePacking = (workspace, rawManifest) => {
    if (rawManifest.publishConfig && rawManifest.publishConfig.typings) rawManifest.typings = rawManifest.publishConfig.typings;

    if (rawManifest.publishConfig && rawManifest.publishConfig.types) {
      rawManifest.types = rawManifest.publishConfig.types;
    }
  };

  const plugin = {
    hooks: {
      afterWorkspaceDependencyAddition,
      afterWorkspaceDependencyRemoval,
      beforeWorkspacePacking
    }
  }; // eslint-disable-next-line arca/no-default-export

  exports.default = plugin;

  /***/ }),
  /* 1 */
  /***/ (function(module, exports) {

  module.exports = require("@yarnpkg/core");

  /***/ }),
  /* 2 */
  /***/ (function(module, exports) {

  module.exports = require("@yarnpkg/plugin-essentials");

  /***/ }),
  /* 3 */
  /***/ (function(module, exports, __webpack_require__) {

  "use strict";


  var __importDefault = this && this.__importDefault || function (mod) {
    return mod && mod.__esModule ? mod : {
      "default": mod
    };
  };

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  const core_1 = __webpack_require__(1);

  const algoliasearch_1 = __importDefault(__webpack_require__(4)); // Note that the appId and appKey are specific to Yarn's plugin-typescript - please
  // don't use them anywhere else without asking Algolia's permission


  const ALGOLIA_API_KEY = 'e8e1bd300d860104bb8c58453ffa1eb4';
  const ALGOLIA_APP_ID = 'OFCNCOG2CU';

  exports.hasDefinitelyTyped = async (descriptor, configuration) => {
    var _a;

    const stringifiedIdent = core_1.structUtils.stringifyIdent(descriptor);
    const algoliaClient = createAlgoliaClient(configuration);
    const index = algoliaClient.initIndex('npm-search');

    try {
      const packageInfo = await index.getObject(stringifiedIdent, {
        attributesToRetrieve: ['types']
      });
      return ((_a = packageInfo.types) === null || _a === void 0 ? void 0 : _a.ts) === 'definitely-typed';
    } catch (_e) {
      return false;
    }
  };

  const createAlgoliaClient = configuration => {
    const requester = {
      async send(request) {
        try {
          const response = await core_1.httpUtils.request(request.url, request.data || null, {
            configuration,
            headers: request.headers
          });
          return {
            content: response.body,
            isTimedOut: false,
            status: response.statusCode
          };
        } catch (error) {
          return {
            content: error.response.body,
            isTimedOut: false,
            status: error.response.statusCode
          };
        }
      }

    };
    return algoliasearch_1.default(ALGOLIA_APP_ID, ALGOLIA_API_KEY, {
      requester
    });
  };

  /***/ }),
  /* 4 */
  /***/ (function(module, exports, __webpack_require__) {

  // eslint-disable-next-line functional/immutable-data, import/no-commonjs
  module.exports = __webpack_require__(5);


  /***/ }),
  /* 5 */
  /***/ (function(module, exports, __webpack_require__) {

  "use strict";


  var cacheCommon = __webpack_require__(6);
  var cacheInMemory = __webpack_require__(7);
  var clientAnalytics = __webpack_require__(8);
  var clientCommon = __webpack_require__(9);
  var clientRecommendation = __webpack_require__(12);
  var clientSearch = __webpack_require__(13);
  var loggerCommon = __webpack_require__(15);
  var requesterNodeHttp = __webpack_require__(16);
  var transporter = __webpack_require__(10);

  function algoliasearch(appId, apiKey, options) {
      const commonOptions = {
          appId,
          apiKey,
          timeouts: {
              connect: 2,
              read: 5,
              write: 30,
          },
          requester: requesterNodeHttp.createNodeHttpRequester(),
          logger: loggerCommon.createNullLogger(),
          responsesCache: cacheCommon.createNullCache(),
          requestsCache: cacheCommon.createNullCache(),
          hostsCache: cacheInMemory.createInMemoryCache(),
          userAgent: transporter.createUserAgent(clientCommon.version).add({
              segment: 'Node.js',
              version: process.versions.node,
          }),
      };
      return clientSearch.createSearchClient({
          ...commonOptions,
          ...options,
          methods: {
              search: clientSearch.multipleQueries,
              searchForFacetValues: clientSearch.multipleSearchForFacetValues,
              multipleBatch: clientSearch.multipleBatch,
              multipleGetObjects: clientSearch.multipleGetObjects,
              multipleQueries: clientSearch.multipleQueries,
              copyIndex: clientSearch.copyIndex,
              copySettings: clientSearch.copySettings,
              copyRules: clientSearch.copyRules,
              copySynonyms: clientSearch.copySynonyms,
              moveIndex: clientSearch.moveIndex,
              listIndices: clientSearch.listIndices,
              getLogs: clientSearch.getLogs,
              listClusters: clientSearch.listClusters,
              multipleSearchForFacetValues: clientSearch.multipleSearchForFacetValues,
              getApiKey: clientSearch.getApiKey,
              addApiKey: clientSearch.addApiKey,
              listApiKeys: clientSearch.listApiKeys,
              updateApiKey: clientSearch.updateApiKey,
              deleteApiKey: clientSearch.deleteApiKey,
              restoreApiKey: clientSearch.restoreApiKey,
              assignUserID: clientSearch.assignUserID,
              assignUserIDs: clientSearch.assignUserIDs,
              getUserID: clientSearch.getUserID,
              searchUserIDs: clientSearch.searchUserIDs,
              listUserIDs: clientSearch.listUserIDs,
              getTopUserIDs: clientSearch.getTopUserIDs,
              removeUserID: clientSearch.removeUserID,
              generateSecuredApiKey: clientSearch.generateSecuredApiKey,
              getSecuredApiKeyRemainingValidity: clientSearch.getSecuredApiKeyRemainingValidity,
              destroy: clientCommon.destroy,
              initIndex: base => (indexName) => {
                  return clientSearch.initIndex(base)(indexName, {
                      methods: {
                          batch: clientSearch.batch,
                          delete: clientSearch.deleteIndex,
                          getObject: clientSearch.getObject,
                          getObjects: clientSearch.getObjects,
                          saveObject: clientSearch.saveObject,
                          saveObjects: clientSearch.saveObjects,
                          search: clientSearch.search,
                          searchForFacetValues: clientSearch.searchForFacetValues,
                          waitTask: clientSearch.waitTask,
                          setSettings: clientSearch.setSettings,
                          getSettings: clientSearch.getSettings,
                          partialUpdateObject: clientSearch.partialUpdateObject,
                          partialUpdateObjects: clientSearch.partialUpdateObjects,
                          deleteObject: clientSearch.deleteObject,
                          deleteObjects: clientSearch.deleteObjects,
                          deleteBy: clientSearch.deleteBy,
                          clearObjects: clientSearch.clearObjects,
                          browseObjects: clientSearch.browseObjects,
                          getObjectPosition: clientSearch.getObjectPosition,
                          findObject: clientSearch.findObject,
                          exists: clientSearch.exists,
                          saveSynonym: clientSearch.saveSynonym,
                          saveSynonyms: clientSearch.saveSynonyms,
                          getSynonym: clientSearch.getSynonym,
                          searchSynonyms: clientSearch.searchSynonyms,
                          browseSynonyms: clientSearch.browseSynonyms,
                          deleteSynonym: clientSearch.deleteSynonym,
                          clearSynonyms: clientSearch.clearSynonyms,
                          replaceAllObjects: clientSearch.replaceAllObjects,
                          replaceAllSynonyms: clientSearch.replaceAllSynonyms,
                          searchRules: clientSearch.searchRules,
                          getRule: clientSearch.getRule,
                          deleteRule: clientSearch.deleteRule,
                          saveRule: clientSearch.saveRule,
                          saveRules: clientSearch.saveRules,
                          replaceAllRules: clientSearch.replaceAllRules,
                          browseRules: clientSearch.browseRules,
                          clearRules: clientSearch.clearRules,
                      },
                  });
              },
              initAnalytics: () => (clientOptions) => {
                  return clientAnalytics.createAnalyticsClient({
                      ...commonOptions,
                      ...clientOptions,
                      methods: {
                          addABTest: clientAnalytics.addABTest,
                          getABTest: clientAnalytics.getABTest,
                          getABTests: clientAnalytics.getABTests,
                          stopABTest: clientAnalytics.stopABTest,
                          deleteABTest: clientAnalytics.deleteABTest,
                      },
                  });
              },
              initRecommendation: () => (clientOptions) => {
                  return clientRecommendation.createRecommendationClient({
                      ...commonOptions,
                      ...clientOptions,
                      methods: {
                          getPersonalizationStrategy: clientRecommendation.getPersonalizationStrategy,
                          setPersonalizationStrategy: clientRecommendation.setPersonalizationStrategy,
                      },
                  });
              },
          },
      });
  }

  module.exports = algoliasearch;


  /***/ }),
  /* 6 */
  /***/ (function(module, __webpack_exports__, __webpack_require__) {

  "use strict";
  __webpack_require__.r(__webpack_exports__);
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createFallbackableCache", function() { return createFallbackableCache; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createNullCache", function() { return createNullCache; });
  // @todo Add logger on options to debug when caches go wrong.
  function createFallbackableCache(options) {
      const caches = [...options.caches];
      const current = caches.shift(); // eslint-disable-line functional/immutable-data
      if (current === undefined) {
          return createNullCache();
      }
      return {
          get(key, defaultValue, events = {
              miss: () => Promise.resolve(),
          }) {
              return current.get(key, defaultValue, events).catch(() => {
                  return createFallbackableCache({ caches }).get(key, defaultValue, events);
              });
          },
          set(key, value) {
              return current.set(key, value).catch(() => {
                  return createFallbackableCache({ caches }).set(key, value);
              });
          },
          delete(key) {
              return current.delete(key).catch(() => {
                  return createFallbackableCache({ caches }).delete(key);
              });
          },
          clear() {
              return current.clear().catch(() => {
                  return createFallbackableCache({ caches }).clear();
              });
          },
      };
  }

  function createNullCache() {
      return {
          get(_key, defaultValue, events = {
              miss: () => Promise.resolve(),
          }) {
              const value = defaultValue();
              return value
                  .then(result => Promise.all([result, events.miss(result)]))
                  .then(([result]) => result);
          },
          set(_key, value) {
              return Promise.resolve(value);
          },
          delete(_key) {
              return Promise.resolve();
          },
          clear() {
              return Promise.resolve();
          },
      };
  }




  /***/ }),
  /* 7 */
  /***/ (function(module, __webpack_exports__, __webpack_require__) {

  "use strict";
  __webpack_require__.r(__webpack_exports__);
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createInMemoryCache", function() { return createInMemoryCache; });
  function createInMemoryCache(options = { serializable: true }) {
      // eslint-disable-next-line functional/no-let
      let cache = {};
      return {
          get(key, defaultValue, events = {
              miss: () => Promise.resolve(),
          }) {
              const keyAsString = JSON.stringify(key);
              if (keyAsString in cache) {
                  return Promise.resolve(options.serializable ? JSON.parse(cache[keyAsString]) : cache[keyAsString]);
              }
              const promise = defaultValue();
              const miss = (events && events.miss) || (() => Promise.resolve());
              return promise.then((value) => miss(value)).then(() => promise);
          },
          set(key, value) {
              // eslint-disable-next-line functional/immutable-data
              cache[JSON.stringify(key)] = options.serializable ? JSON.stringify(value) : value;
              return Promise.resolve(value);
          },
          delete(key) {
              // eslint-disable-next-line functional/immutable-data
              delete cache[JSON.stringify(key)];
              return Promise.resolve();
          },
          clear() {
              cache = {};
              return Promise.resolve();
          },
      };
  }




  /***/ }),
  /* 8 */
  /***/ (function(module, __webpack_exports__, __webpack_require__) {

  "use strict";
  __webpack_require__.r(__webpack_exports__);
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "addABTest", function() { return addABTest; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createAnalyticsClient", function() { return createAnalyticsClient; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "deleteABTest", function() { return deleteABTest; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getABTest", function() { return getABTest; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getABTests", function() { return getABTests; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "stopABTest", function() { return stopABTest; });
  /* harmony import */ var _algolia_client_common__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9);
  /* harmony import */ var _algolia_transporter__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(10);
  /* harmony import */ var _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(11);




  const createAnalyticsClient = options => {
      const region = options.region || 'us';
      const auth = Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createAuth"])(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["AuthMode"].WithinHeaders, options.appId, options.apiKey);
      const transporter = Object(_algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["createTransporter"])({
          hosts: [{ url: `analytics.${region}.algolia.com`, accept: _algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["CallEnum"].Any }],
          ...options,
          headers: {
              ...auth.headers(),
              ...{ 'content-type': 'application/json' },
              ...options.headers,
          },
          queryParameters: {
              ...auth.queryParameters(),
              ...options.queryParameters,
          },
      });
      const appId = options.appId;
      return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["addMethods"])({ appId, transporter }, options.methods);
  };

  const addABTest = (base) => {
      return (abTest, requestOptions) => {
          return base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: '2/abtests',
              data: abTest,
          }, requestOptions);
      };
  };

  const deleteABTest = (base) => {
      return (abTestID, requestOptions) => {
          return base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Delete,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('2/abtests/%s', abTestID),
          }, requestOptions);
      };
  };

  const getABTest = (base) => {
      return (abTestID, requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Get,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('2/abtests/%s', abTestID),
          }, requestOptions);
      };
  };

  const getABTests = (base) => {
      return (requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Get,
              path: '2/abtests',
          }, requestOptions);
      };
  };

  const stopABTest = (base) => {
      return (abTestID, requestOptions) => {
          return base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('2/abtests/%s/stop', abTestID),
          }, requestOptions);
      };
  };




  /***/ }),
  /* 9 */
  /***/ (function(module, __webpack_exports__, __webpack_require__) {

  "use strict";
  __webpack_require__.r(__webpack_exports__);
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "AuthMode", function() { return AuthMode; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "addMethods", function() { return addMethods; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createAuth", function() { return createAuth; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createRetryablePromise", function() { return createRetryablePromise; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createWaitablePromise", function() { return createWaitablePromise; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "destroy", function() { return destroy; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "encode", function() { return encode; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "shuffle", function() { return shuffle; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "version", function() { return version; });
  function createAuth(authMode, appId, apiKey) {
      const credentials = {
          'x-algolia-api-key': apiKey,
          'x-algolia-application-id': appId,
      };
      return {
          headers() {
              return authMode === AuthMode.WithinHeaders ? credentials : {};
          },
          queryParameters() {
              return authMode === AuthMode.WithinQueryParameters ? credentials : {};
          },
      };
  }

  function createRetryablePromise(callback) {
      let retriesCount = 0; // eslint-disable-line functional/no-let
      const retry = () => {
          retriesCount++;
          return new Promise((resolve) => {
              setTimeout(() => {
                  resolve(callback(retry));
              }, Math.min(100 * retriesCount, 1000));
          });
      };
      return callback(retry);
  }

  function createWaitablePromise(promise, wait = (_response, _requestOptions) => {
      return Promise.resolve();
  }) {
      // eslint-disable-next-line functional/immutable-data
      return Object.assign(promise, {
          wait(requestOptions) {
              return createWaitablePromise(promise
                  .then(response => Promise.all([wait(response, requestOptions), response]))
                  .then(promiseResults => promiseResults[1]));
          },
      });
  }

  // eslint-disable-next-line functional/prefer-readonly-type
  function shuffle(array) {
      let c = array.length - 1; // eslint-disable-line functional/no-let
      // eslint-disable-next-line functional/no-loop-statement
      for (c; c > 0; c--) {
          const b = Math.floor(Math.random() * (c + 1));
          const a = array[c];
          array[c] = array[b]; // eslint-disable-line functional/immutable-data, no-param-reassign
          array[b] = a; // eslint-disable-line functional/immutable-data, no-param-reassign
      }
      return array;
  }
  function addMethods(base, methods) {
      Object.keys(methods !== undefined ? methods : {}).forEach(key => {
          // @ts-ignore
          // eslint-disable-next-line functional/immutable-data, no-param-reassign
          base[key] = methods[key](base);
      });
      // @ts-ignore
      return base;
  }
  function encode(format, ...args) {
      // eslint-disable-next-line functional/no-let
      let i = 0;
      return format.replace(/%s/g, () => encodeURIComponent(args[i++]));
  }

  const version = '4.0.0-beta.14';

  const destroy = (base) => {
      return () => {
          return base.transporter.requester.destroy();
      };
  };

  const AuthMode = {
      /**
       * If auth credentials should be in query parameters.
       */
      WithinQueryParameters: 0,
      /**
       * If auth credentials should be in headers.
       */
      WithinHeaders: 1,
  };




  /***/ }),
  /* 10 */
  /***/ (function(module, __webpack_exports__, __webpack_require__) {

  "use strict";
  __webpack_require__.r(__webpack_exports__);
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "CallEnum", function() { return CallEnum; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "HostStatusEnum", function() { return HostStatusEnum; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createApiError", function() { return createApiError; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createDeserializationError", function() { return createDeserializationError; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createMappedRequestOptions", function() { return createMappedRequestOptions; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createRetryError", function() { return createRetryError; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createStatefulHost", function() { return createStatefulHost; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createStatelessHost", function() { return createStatelessHost; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createTransporter", function() { return createTransporter; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createUserAgent", function() { return createUserAgent; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "deserializeFailure", function() { return deserializeFailure; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "deserializeSuccess", function() { return deserializeSuccess; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "isStatefulHostTimeouted", function() { return isStatefulHostTimeouted; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "isStatefulHostUp", function() { return isStatefulHostUp; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "serializeData", function() { return serializeData; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "serializeHeaders", function() { return serializeHeaders; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "serializeQueryParameters", function() { return serializeQueryParameters; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "serializeUrl", function() { return serializeUrl; });
  /* harmony import */ var _algolia_requester_common__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(11);


  function createMappedRequestOptions(requestOptions, timeout) {
      const options = requestOptions || {};
      const data = options.data || {};
      Object.keys(options).forEach(key => {
          if (['timeout', 'headers', 'queryParameters', 'data', 'cacheable'].indexOf(key) === -1) {
              data[key] = options[key]; // eslint-disable-line functional/immutable-data
          }
      });
      return {
          data: Object.entries(data).length > 0 ? data : undefined,
          timeout: options.timeout || timeout,
          headers: options.headers || {},
          queryParameters: options.queryParameters || {},
          cacheable: options.cacheable,
      };
  }

  const CallEnum = {
      /**
       * If the host is read only.
       */
      Read: 1,
      /**
       * If the host is write only.
       */
      Write: 2,
      /**
       * If the host is both read and write.
       */
      Any: 3,
  };

  const HostStatusEnum = {
      Up: 1,
      Down: 2,
      Timeouted: 3,
  };

  // By default, API Clients at Algolia have expiration delay
  // of 5 mins. In the JavaScript client, we have 2 mins.
  const EXPIRATION_DELAY = 2 * 60 * 1000;
  function createStatefulHost(host, status = HostStatusEnum.Up) {
      return {
          ...host,
          status,
          lastUpdate: Date.now(),
      };
  }
  function isStatefulHostUp(host) {
      return host.status === HostStatusEnum.Up || Date.now() - host.lastUpdate > EXPIRATION_DELAY;
  }
  function isStatefulHostTimeouted(host) {
      return (host.status === HostStatusEnum.Timeouted && Date.now() - host.lastUpdate <= EXPIRATION_DELAY);
  }

  function createStatelessHost(options) {
      return {
          protocol: options.protocol || 'https',
          url: options.url,
          accept: options.accept,
      };
  }

  function createRetryableOptions(hostsCache, statelessHosts) {
      return Promise.all(statelessHosts.map(statelessHost => {
          return hostsCache.get(statelessHost, () => {
              return Promise.resolve(createStatefulHost(statelessHost));
          });
      })).then(statefulHosts => {
          const hostsUp = statefulHosts.filter(host => isStatefulHostUp(host));
          const hostsTimeouted = statefulHosts.filter(host => isStatefulHostTimeouted(host));
          /**
           * Note, we put the hosts that previously timeouted on the end of the list.
           */
          const hostsAvailable = [...hostsUp, ...hostsTimeouted];
          const statelessHostsAvailable = hostsAvailable.length > 0
              ? hostsAvailable.map(host => createStatelessHost(host))
              : statelessHosts;
          return {
              getTimeout(timeoutsCount, baseTimeout) {
                  /**
                   * Imagine that you have 4 hosts, if timeouts will increase
                   * on the following way: 1 (timeouted) > 4 (timeouted) > 5 (200)
                   *
                   * Note that, the very next request, we start from the previous timeout
                   *
                   *  5 (timeouted) > 6 (timeouted) > 7 ...
                   *
                   * This strategy may need to be reviewed, but is the strategy on the our
                   * current v3 version.
                   */
                  const timeoutMultiplier = hostsTimeouted.length === 0 && timeoutsCount === 0
                      ? 1
                      : hostsTimeouted.length + 3 + timeoutsCount;
                  return timeoutMultiplier * baseTimeout;
              },
              statelessHosts: statelessHostsAvailable,
          };
      });
  }

  const isNetworkError = ({ isTimedOut, status }) => {
      return !isTimedOut && ~~status === 0;
  };
  const isRetryable = (response) => {
      const status = response.status;
      const isTimedOut = response.isTimedOut;
      return (isTimedOut || isNetworkError(response) || (~~(status / 100) !== 2 && ~~(status / 100) !== 4));
  };
  const isSuccess = ({ status }) => {
      return ~~(status / 100) === 2;
  };
  const retryDecision = (response, outcomes) => {
      if (isRetryable(response)) {
          return outcomes.onRetry(response);
      }
      if (isSuccess(response)) {
          return outcomes.onSucess(response);
      }
      return outcomes.onFail(response);
  };

  function retryableRequest(transporter, statelessHosts, request, requestOptions) {
      const stackTrace = []; // eslint-disable-line functional/prefer-readonly-type
      /**
       * First we prepare the payload that do not depend from hosts.
       */
      const data = serializeData(request, requestOptions);
      const headers = serializeHeaders(transporter, requestOptions);
      const method = request.method;
      // On `GET`, the data is proxied to query parameters.
      const dataQueryParameters = request.method !== _algolia_requester_common__WEBPACK_IMPORTED_MODULE_0__["MethodEnum"].Get
          ? {}
          : {
              ...request.data,
              ...requestOptions.data,
          };
      const queryParameters = {
          'x-algolia-agent': transporter.userAgent.value,
          ...transporter.queryParameters,
          ...dataQueryParameters,
          ...requestOptions.queryParameters,
      };
      let timeoutsCount = 0; // eslint-disable-line functional/no-let
      const retry = (hosts, // eslint-disable-line functional/prefer-readonly-type
      getTimeout) => {
          /**
           * We iterate on each host, until there is no host left.
           */
          const host = hosts.pop(); // eslint-disable-line functional/immutable-data
          if (host === undefined) {
              throw createRetryError(stackTrace);
          }
          const payload = {
              data,
              headers,
              method,
              url: serializeUrl(host, request.path, queryParameters),
              connectTimeout: getTimeout(timeoutsCount, transporter.timeouts.connect),
              responseTimeout: getTimeout(timeoutsCount, requestOptions.timeout),
          };
          const decisions = {
              onSucess: response => deserializeSuccess(response),
              onRetry(response) {
                  const stackFrame = {
                      request: payload,
                      response,
                      host,
                      triesLeft: hosts.length,
                  };
                  /**
                   * The stackFrace is pushed to the stackTrace so we
                   * can have information about the failures once a
                   * retry error is thrown.
                   */
                  stackTrace.push(stackFrame); // eslint-disable-line functional/immutable-data
                  /**
                   * If response is a timeout, we increaset the number of
                   * timeouts so we can increase the timeout later.
                   */
                  if (response.isTimedOut) {
                      timeoutsCount++;
                  }
                  return Promise.all([
                      /**
                       * Failures are individually send the logger, allowing
                       * the end user to debug / store stack frames even
                       * when a retry error does not happen.
                       */
                      transporter.logger.debug('Retryable failure', stackFrame),
                      /**
                       * We also store the state of the host in failure cases. If the host, is
                       * down it will remain down for the next 2 minutes. In a timeout situation,
                       * this host will be added end of the list of hosts on the next request.
                       */
                      transporter.hostsCache.set(host, createStatefulHost(host, response.isTimedOut ? HostStatusEnum.Timeouted : HostStatusEnum.Down)),
                  ]).then(() => retry(hosts, getTimeout));
              },
              onFail(response) {
                  throw deserializeFailure(response);
              },
          };
          return transporter.requester.send(payload).then(response => {
              return retryDecision(response, decisions);
          });
      };
      /**
       * Finally, for each retryable host perform request until we got a non
       * retryable response. Some notes here:
       *
       * 1. The reverse here is applied so we can apply a `pop` later on => more performant.
       * 2. We also get from the retryable options a timeout multiplier that is tailored
       * for the current context.
       */
      return createRetryableOptions(transporter.hostsCache, statelessHosts).then(options => {
          return retry([...options.statelessHosts].reverse(), options.getTimeout);
      });
  }

  function createTransporter(options) {
      const { hostsCache, logger, requester, requestsCache, responsesCache, timeouts, userAgent, hosts, queryParameters, headers, } = options;
      const transporter = {
          hostsCache,
          logger,
          requester,
          requestsCache,
          responsesCache,
          timeouts,
          userAgent,
          headers,
          queryParameters,
          hosts: hosts.map(host => createStatelessHost(host)),
          read(request, requestOptions) {
              /**
               * First, we compute the user request options. Now, keep in mind,
               * that using request options the user is able to modified the intire
               * payload of the request. Such as headers, query parameters, and others.
               */
              const mappedRequestOptions = createMappedRequestOptions(requestOptions, transporter.timeouts.read);
              const createRetryableRequest = () => {
                  /**
                   * Then, we prepare a function factory that contains the construction of
                   * the retryable request. At this point, we may *not* perform the actual
                   * request. But we want to have the function factory ready.
                   */
                  return retryableRequest(transporter, transporter.hosts.filter(host => (host.accept & CallEnum.Read) !== 0), request, mappedRequestOptions);
              };
              /**
               * Once we have the function factory ready, we need to determine of the
               * request is "cacheable" - should be cached. Note that, once again,
               * the user can force this option.
               */
              const cacheable = mappedRequestOptions.cacheable !== undefined
                  ? mappedRequestOptions.cacheable
                  : request.cacheable;
              /**
               * If is not "cacheable", we immediatly trigger the retryable request, no
               * need to check cache implementations.
               */
              if (cacheable !== true) {
                  return createRetryableRequest();
              }
              /**
               * If the request is "cacheable", we need to first compute the key to ask
               * the cache implementations if this request is on progress or if the
               * response already exists on the cache.
               */
              const key = {
                  request,
                  mappedRequestOptions,
                  transporter: {
                      queryParameters: transporter.queryParameters,
                      headers: transporter.headers,
                  },
              };
              /**
               * With the computed key, we first ask the responses cache
               * implemention if this request was been resolved before.
               */
              return transporter.responsesCache.get(key, () => {
                  /**
                   * If the request has never resolved before, we actually ask if there
                   * is a current request with the same key on progress.
                   */
                  return transporter.requestsCache.get(key, () => {
                      return (transporter.requestsCache
                          /**
                           * Finally, if there is no request in progress with the same key,
                           * this `createRetryableRequest()` will actually trigger the
                           * retryable request.
                           */
                          .set(key, createRetryableRequest())
                          .then(response => Promise.all([transporter.requestsCache.delete(key), response]), err => Promise.all([transporter.requestsCache.delete(key), Promise.reject(err)]))
                          .then(([_, response]) => response));
                  });
              }, {
                  /**
                   * Of course, once we get this response back from the server, we
                   * tell response cache to actually store the received response
                   * to be used later.
                   */
                  miss: response => transporter.responsesCache.set(key, response),
              });
          },
          write(request, requestOptions) {
              /**
               * On write requests, no cache mechanisms are applied, and we
               * proxy the request immediately to the requester.
               */
              return retryableRequest(transporter, transporter.hosts.filter(host => (host.accept & CallEnum.Write) !== 0), request, createMappedRequestOptions(requestOptions, transporter.timeouts.write));
          },
      };
      return transporter;
  }

  function createUserAgent(version) {
      const userAgent = {
          value: `Algolia for JavaScript (${version})`,
          add(options) {
              const addedUserAgent = `; ${options.segment}${options.version !== undefined ? ` (${options.version})` : ''}`;
              if (userAgent.value.indexOf(addedUserAgent) === -1) {
                  // eslint-disable-next-line functional/immutable-data
                  userAgent.value = `${userAgent.value}${addedUserAgent}`;
              }
              return userAgent;
          },
      };
      return userAgent;
  }

  function createDeserializationError(message, response) {
      return {
          name: 'DeserializationError',
          message,
          response,
      };
  }

  function deserializeSuccess(response) {
      // eslint-disable-next-line functional/no-try-statement
      try {
          return JSON.parse(response.content);
      }
      catch (e) {
          throw createDeserializationError(e.message, response);
      }
  }
  function deserializeFailure({ content, status }) {
      // eslint-disable-next-line functional/no-let
      let message = content;
      // eslint-disable-next-line functional/no-try-statement
      try {
          message = JSON.parse(content).message;
      }
      catch (e) {
          // ..
      }
      return createApiError(message, status);
  }

  // eslint-disable-next-line functional/prefer-readonly-type
  function encode(format, ...args) {
      // eslint-disable-next-line functional/no-let
      let i = 0;
      return format.replace(/%s/g, () => encodeURIComponent(args[i++]));
  }

  function serializeUrl(host, path, queryParameters) {
      const queryParametersAsString = serializeQueryParameters(queryParameters);
      // eslint-disable-next-line functional/no-let
      let url = `${host.protocol}://${host.url}/${path.charAt(0) === '/' ? path.substr(1) : path}`;
      if (queryParametersAsString.length) {
          url += `?${queryParametersAsString}`;
      }
      return url;
  }
  function serializeQueryParameters(parameters) {
      const isObjectOrArray = (value) => Object.prototype.toString.call(value) === '[object Object]' ||
          Object.prototype.toString.call(value) === '[object Array]';
      return Object.keys(parameters)
          .map(key => encode('%s=%s', key, isObjectOrArray(parameters[key]) ? JSON.stringify(parameters[key]) : parameters[key]))
          .join('&');
  }
  function serializeData(request, requestOptions) {
      if (request.method === _algolia_requester_common__WEBPACK_IMPORTED_MODULE_0__["MethodEnum"].Get ||
          (request.data === undefined && requestOptions.data === undefined)) {
          return undefined;
      }
      const data = Array.isArray(request.data)
          ? request.data
          : { ...request.data, ...requestOptions.data };
      return JSON.stringify(data);
  }
  function serializeHeaders(transporter, requestOptions) {
      const headers = {
          ...transporter.headers,
          ...requestOptions.headers,
      };
      const serializedHeaders = {};
      Object.keys(headers).forEach(header => {
          const value = headers[header];
          // @ts-ignore
          // eslint-disable-next-line functional/immutable-data
          serializedHeaders[header.toLowerCase()] = value;
      });
      return serializedHeaders;
  }

  function createApiError(message, status) {
      return {
          name: 'ApiError',
          message,
          status,
      };
  }

  function createRetryError(stackTrace) {
      return {
          name: 'RetryError',
          message: 'Unreachable hosts - your application id may be incorrect. If the error persists, contact support@algolia.com.',
          stackTrace,
      };
  }




  /***/ }),
  /* 11 */
  /***/ (function(module, __webpack_exports__, __webpack_require__) {

  "use strict";
  __webpack_require__.r(__webpack_exports__);
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "MethodEnum", function() { return MethodEnum; });
  const MethodEnum = {
      Delete: 'DELETE',
      Get: 'GET',
      Post: 'POST',
      Put: 'PUT',
  };




  /***/ }),
  /* 12 */
  /***/ (function(module, __webpack_exports__, __webpack_require__) {

  "use strict";
  __webpack_require__.r(__webpack_exports__);
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createRecommendationClient", function() { return createRecommendationClient; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getPersonalizationStrategy", function() { return getPersonalizationStrategy; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "setPersonalizationStrategy", function() { return setPersonalizationStrategy; });
  /* harmony import */ var _algolia_client_common__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9);
  /* harmony import */ var _algolia_transporter__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(10);
  /* harmony import */ var _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(11);




  const createRecommendationClient = options => {
      const region = options.region || 'us';
      const auth = Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createAuth"])(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["AuthMode"].WithinHeaders, options.appId, options.apiKey);
      const transporter = Object(_algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["createTransporter"])({
          hosts: [{ url: `recommendation.${region}.algolia.com`, accept: _algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["CallEnum"].Any }],
          ...options,
          headers: {
              ...auth.headers(),
              ...{ 'content-type': 'application/json' },
              ...options.headers,
          },
          queryParameters: {
              ...auth.queryParameters(),
              ...options.queryParameters,
          },
      });
      return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["addMethods"])({ appId: options.appId, transporter }, options.methods);
  };

  const getPersonalizationStrategy = (base) => {
      return (requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Get,
              path: '1/strategies/personalization',
          }, requestOptions);
      };
  };

  const setPersonalizationStrategy = (base) => {
      return (personalizationStrategy, requestOptions) => {
          return base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: '1/strategies/personalization',
              data: personalizationStrategy,
          }, requestOptions);
      };
  };




  /***/ }),
  /* 13 */
  /***/ (function(module, __webpack_exports__, __webpack_require__) {

  "use strict";
  __webpack_require__.r(__webpack_exports__);
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "BatchActionEnum", function() { return BatchActionEnum; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "ScopeEnum", function() { return ScopeEnum; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "StrategyEnum", function() { return StrategyEnum; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "SynonymEnum", function() { return SynonymEnum; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "addApiKey", function() { return addApiKey; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "assignUserID", function() { return assignUserID; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "assignUserIDs", function() { return assignUserIDs; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "batch", function() { return batch; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "browseObjects", function() { return browseObjects; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "browseRules", function() { return browseRules; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "browseSynonyms", function() { return browseSynonyms; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "chunkedBatch", function() { return chunkedBatch; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "clearObjects", function() { return clearObjects; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "clearRules", function() { return clearRules; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "clearSynonyms", function() { return clearSynonyms; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "copyIndex", function() { return copyIndex; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "copyRules", function() { return copyRules; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "copySettings", function() { return copySettings; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "copySynonyms", function() { return copySynonyms; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createBrowsablePromise", function() { return createBrowsablePromise; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createMissingObjectIDError", function() { return createMissingObjectIDError; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createObjectNotFoundError", function() { return createObjectNotFoundError; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createSearchClient", function() { return createSearchClient; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createValidUntilNotFoundError", function() { return createValidUntilNotFoundError; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "deleteApiKey", function() { return deleteApiKey; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "deleteBy", function() { return deleteBy; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "deleteIndex", function() { return deleteIndex; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "deleteObject", function() { return deleteObject; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "deleteObjects", function() { return deleteObjects; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "deleteRule", function() { return deleteRule; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "deleteSynonym", function() { return deleteSynonym; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "exists", function() { return exists; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "findObject", function() { return findObject; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "generateSecuredApiKey", function() { return generateSecuredApiKey; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getApiKey", function() { return getApiKey; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getLogs", function() { return getLogs; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getObject", function() { return getObject; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getObjectPosition", function() { return getObjectPosition; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getObjects", function() { return getObjects; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getRule", function() { return getRule; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getSecuredApiKeyRemainingValidity", function() { return getSecuredApiKeyRemainingValidity; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getSettings", function() { return getSettings; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getSynonym", function() { return getSynonym; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getTask", function() { return getTask; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getTopUserIDs", function() { return getTopUserIDs; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getUserID", function() { return getUserID; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "initIndex", function() { return initIndex; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "listApiKeys", function() { return listApiKeys; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "listClusters", function() { return listClusters; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "listIndices", function() { return listIndices; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "listUserIDs", function() { return listUserIDs; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "moveIndex", function() { return moveIndex; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "multipleBatch", function() { return multipleBatch; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "multipleGetObjects", function() { return multipleGetObjects; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "multipleQueries", function() { return multipleQueries; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "multipleSearchForFacetValues", function() { return multipleSearchForFacetValues; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "partialUpdateObject", function() { return partialUpdateObject; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "partialUpdateObjects", function() { return partialUpdateObjects; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "removeUserID", function() { return removeUserID; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "replaceAllObjects", function() { return replaceAllObjects; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "replaceAllRules", function() { return replaceAllRules; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "replaceAllSynonyms", function() { return replaceAllSynonyms; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "restoreApiKey", function() { return restoreApiKey; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "saveObject", function() { return saveObject; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "saveObjects", function() { return saveObjects; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "saveRule", function() { return saveRule; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "saveRules", function() { return saveRules; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "saveSynonym", function() { return saveSynonym; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "saveSynonyms", function() { return saveSynonyms; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "search", function() { return search; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "searchForFacetValues", function() { return searchForFacetValues; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "searchRules", function() { return searchRules; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "searchSynonyms", function() { return searchSynonyms; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "searchUserIDs", function() { return searchUserIDs; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "setSettings", function() { return setSettings; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "updateApiKey", function() { return updateApiKey; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "waitTask", function() { return waitTask; });
  /* harmony import */ var _algolia_client_common__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9);
  /* harmony import */ var _algolia_transporter__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(10);
  /* harmony import */ var _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(11);
  /* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(14);
  /* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(crypto__WEBPACK_IMPORTED_MODULE_3__);





  function createBrowsablePromise(options) {
      return new Promise(resolve => {
          const data = { page: 0 };
          const browse = () => {
              return options.request(data).then(response => {
                  if (options.batch !== undefined) {
                      options.batch(response.hits);
                  }
                  if (options.shouldStop(response)) {
                      return resolve();
                  }
                  // eslint-disable-next-line functional/immutable-data
                  data.page++;
                  return browse();
              });
          };
          return browse();
      });
  }

  const createSearchClient = options => {
      const appId = options.appId;
      const auth = Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createAuth"])(options.authMode !== undefined ? options.authMode : _algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["AuthMode"].WithinHeaders, appId, options.apiKey);
      const transporter = Object(_algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["createTransporter"])({
          hosts: [
              { url: `${appId}-dsn.algolia.net`, accept: _algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["CallEnum"].Read },
              { url: `${appId}.algolia.net`, accept: _algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["CallEnum"].Write },
          ].concat(Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["shuffle"])([
              { url: `${appId}-1.algolianet.com`, accept: _algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["CallEnum"].Any },
              { url: `${appId}-2.algolianet.com`, accept: _algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["CallEnum"].Any },
              { url: `${appId}-3.algolianet.com`, accept: _algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["CallEnum"].Any },
          ])),
          ...options,
          headers: {
              ...auth.headers(),
              ...{ 'content-type': 'application/x-www-form-urlencoded' },
              ...options.headers,
          },
          queryParameters: {
              ...auth.queryParameters(),
              ...options.queryParameters,
          },
      });
      const base = {
          transporter,
          appId,
          addAlgoliaAgent(segment, version) {
              transporter.userAgent.add({ segment, version });
          },
          clearCache() {
              return Promise.all([
                  transporter.requestsCache.clear(),
                  transporter.responsesCache.clear(),
              ]).then(() => undefined);
          },
      };
      return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["addMethods"])(base, options.methods);
  };

  function createMissingObjectIDError() {
      return {
          name: 'MissingObjectIDError',
          message: 'All objects must have an unique objectID ' +
              '(like a primary key) to be valid. ' +
              'Algolia is also able to generate objectIDs ' +
              "automatically but *it's not recommended*. " +
              "To do it, use the `{'autoGenerateObjectIDIfNotExist': true}` option.",
      };
  }

  function createObjectNotFoundError() {
      return {
          name: 'ObjectNotFoundError',
          message: 'Object not found.',
      };
  }

  function createValidUntilNotFoundError() {
      return {
          name: 'ValidUntilNotFoundError',
          message: 'ValidUntil not found in given secured api key.',
      };
  }

  const addApiKey = (base) => {
      return (acl, requestOptions) => {
          const { queryParameters, ...options } = requestOptions || {};
          const data = {
              acl,
              ...(queryParameters !== undefined ? { queryParameters } : {}),
          };
          const wait = (response, waitRequestOptions) => {
              return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createRetryablePromise"])(retry => {
                  return getApiKey(base)(response.key, waitRequestOptions).catch((apiError) => {
                      if (apiError.status !== 404) {
                          throw apiError;
                      }
                      return retry();
                  });
              });
          };
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: '1/keys',
              data,
          }, options), wait);
      };
  };

  const assignUserID = (base) => {
      return (userID, clusterName, requestOptions) => {
          const mappedRequestOptions = Object(_algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["createMappedRequestOptions"])(requestOptions);
          // eslint-disable-next-line functional/immutable-data
          mappedRequestOptions.headers['X-Algolia-User-ID'] = userID;
          return base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: '1/clusters/mapping',
              data: {
                  cluster: clusterName,
              },
          }, mappedRequestOptions);
      };
  };

  const assignUserIDs = (base) => {
      return (userIDs, clusterName, requestOptions) => {
          return base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: '1/clusters/mapping/batch',
              data: {
                  users: userIDs,
                  cluster: clusterName,
              },
          }, requestOptions);
      };
  };

  const copyIndex = (base) => {
      return (from, to, requestOptions) => {
          const wait = (response, waitRequestOptions) => {
              return initIndex(base)(from, {
                  methods: { waitTask },
              }).waitTask(response.taskID, waitRequestOptions);
          };
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/operation', from),
              data: {
                  operation: 'copy',
                  destination: to,
              },
          }, requestOptions), wait);
      };
  };

  const copyRules = (base) => {
      return (from, to, requestOptions) => {
          return copyIndex(base)(from, to, {
              ...requestOptions,
              scope: [ScopeEnum.Rules],
          });
      };
  };

  const copySettings = (base) => {
      return (from, to, requestOptions) => {
          return copyIndex(base)(from, to, {
              ...requestOptions,
              scope: [ScopeEnum.Settings],
          });
      };
  };

  const copySynonyms = (base) => {
      return (from, to, requestOptions) => {
          return copyIndex(base)(from, to, {
              ...requestOptions,
              scope: [ScopeEnum.Synonyms],
          });
      };
  };

  const deleteApiKey = (base) => {
      return (apiKey, requestOptions) => {
          const wait = (_, waitRequestOptions) => {
              return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createRetryablePromise"])(retry => {
                  return getApiKey(base)(apiKey, waitRequestOptions)
                      .then(retry)
                      .catch((apiError) => {
                      if (apiError.status !== 404) {
                          throw apiError;
                      }
                  });
              });
          };
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Delete,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/keys/%s', apiKey),
          }, requestOptions), wait);
      };
  };

  const generateSecuredApiKey = () => {
      return (parentApiKey, restrictions) => {
          const queryParameters = Object(_algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["serializeQueryParameters"])(restrictions);
          const securedKey = Object(crypto__WEBPACK_IMPORTED_MODULE_3__["createHmac"])('sha256', parentApiKey)
              .update(queryParameters)
              .digest('hex');
          return Buffer.from(securedKey + queryParameters).toString('base64');
      };
  };

  const getApiKey = (base) => {
      return (apiKey, requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Get,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/keys/%s', apiKey),
          }, requestOptions);
      };
  };

  const getLogs = (base) => {
      return (requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Get,
              path: '1/logs',
          }, requestOptions);
      };
  };

  const getSecuredApiKeyRemainingValidity = () => {
      return (securedApiKey) => {
          const decodedString = Buffer.from(securedApiKey, 'base64').toString('ascii');
          const regex = /validUntil=(\d+)/;
          const match = decodedString.match(regex);
          if (match === null) {
              throw createValidUntilNotFoundError();
          }
          return parseInt(match[1], 10) - Math.round(new Date().getTime() / 1000);
      };
  };

  const getTopUserIDs = (base) => {
      return (requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Get,
              path: '1/clusters/mapping/top',
          }, requestOptions);
      };
  };

  const getUserID = (base) => {
      return (userID, requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Get,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/clusters/mapping/%s', userID),
          }, requestOptions);
      };
  };

  const initIndex = (base) => {
      return (indexName, options = {}) => {
          const searchIndex = {
              transporter: base.transporter,
              appId: base.appId,
              indexName,
          };
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["addMethods"])(searchIndex, options.methods);
      };
  };

  const listApiKeys = (base) => {
      return (requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Get,
              path: '1/keys',
          }, requestOptions);
      };
  };

  const listClusters = (base) => {
      return (requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Get,
              path: '1/clusters',
          }, requestOptions);
      };
  };

  const listIndices = (base) => {
      return (requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Get,
              path: '1/indexes',
          }, requestOptions);
      };
  };

  const listUserIDs = (base) => {
      return (requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Get,
              path: '1/clusters/mapping',
          }, requestOptions);
      };
  };

  const moveIndex = (base) => {
      return (from, to, requestOptions) => {
          const wait = (response, waitRequestOptions) => {
              return initIndex(base)(from, {
                  methods: { waitTask },
              }).waitTask(response.taskID, waitRequestOptions);
          };
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/operation', from),
              data: {
                  operation: 'move',
                  destination: to,
              },
          }, requestOptions), wait);
      };
  };

  const multipleBatch = (base) => {
      return (requests, requestOptions) => {
          const wait = (response, waitRequestOptions) => {
              return Promise.all(Object.keys(response.taskID).map(indexName => {
                  return initIndex(base)(indexName, {
                      methods: { waitTask },
                  }).waitTask(response.taskID[indexName], waitRequestOptions);
              }));
          };
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: '1/indexes/*/batch',
              data: {
                  requests,
              },
          }, requestOptions), wait);
      };
  };

  const multipleGetObjects = (base) => {
      return (requests, requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: '1/indexes/*/objects',
              data: {
                  requests,
              },
          }, requestOptions);
      };
  };

  const multipleQueries = (base) => {
      return (queries, requestOptions) => {
          const requests = queries.map(query => {
              return {
                  ...query,
                  params: Object(_algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["serializeQueryParameters"])(query.params || {}),
              };
          });
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: '1/indexes/*/queries',
              data: {
                  requests,
              },
              cacheable: true,
          }, requestOptions);
      };
  };

  const multipleSearchForFacetValues = (base) => {
      return (queries, requestOptions) => {
          return Promise.all(queries.map(query => {
              const { facetName, facetQuery, ...params } = query.params;
              return initIndex(base)(query.indexName, {
                  methods: { searchForFacetValues },
              }).searchForFacetValues(facetName, facetQuery, {
                  ...requestOptions,
                  ...params,
              });
          }));
      };
  };

  const removeUserID = (base) => {
      return (userID, requestOptions) => {
          const mappedRequestOptions = Object(_algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["createMappedRequestOptions"])(requestOptions);
          // eslint-disable-next-line functional/immutable-data
          mappedRequestOptions.headers['X-Algolia-User-ID'] = userID;
          return base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Delete,
              path: '1/clusters/mapping',
          }, mappedRequestOptions);
      };
  };

  const restoreApiKey = (base) => {
      return (apiKey, requestOptions) => {
          const wait = (_, waitRequestOptions) => {
              return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createRetryablePromise"])(retry => {
                  return getApiKey(base)(apiKey, waitRequestOptions).catch((apiError) => {
                      if (apiError.status !== 404) {
                          throw apiError;
                      }
                      return retry();
                  });
              });
          };
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/keys/%s/restore', apiKey),
          }, requestOptions), wait);
      };
  };

  const searchUserIDs = (base) => {
      return (query, requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: '1/clusters/mapping/search',
              data: {
                  query,
              },
          }, requestOptions);
      };
  };

  const updateApiKey = (base) => {
      return (apiKey, requestOptions) => {
          const updatedFields = Object.assign({}, requestOptions);
          const { queryParameters, ...options } = requestOptions || {};
          const data = queryParameters ? { queryParameters } : {};
          const apiKeyFields = [
              'acl',
              'indexes',
              'referers',
              'restrictSources',
              'queryParameters',
              'description',
              'maxQueriesPerIPPerHour',
              'maxHitsPerQuery',
          ];
          const hasChanged = (getApiKeyResponse) => {
              return Object.keys(updatedFields)
                  .filter(updatedField => apiKeyFields.indexOf(updatedField) !== -1)
                  .every(updatedField => {
                  return (
                  // @ts-ignore
                  getApiKeyResponse[updatedField] === updatedFields[updatedField]);
              });
          };
          const wait = (_, waitRequestOptions) => Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createRetryablePromise"])(retry => {
              return getApiKey(base)(apiKey, waitRequestOptions).then(getApiKeyResponse => {
                  return hasChanged(getApiKeyResponse) ? Promise.resolve() : retry();
              });
          });
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Put,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/keys/%s', apiKey),
              data,
          }, options), wait);
      };
  };

  const batch = (base) => {
      return (requests, requestOptions) => {
          const wait = (response, waitRequestOptions) => {
              return waitTask(base)(response.taskID, waitRequestOptions);
          };
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/batch', base.indexName),
              data: {
                  requests,
              },
          }, requestOptions), wait);
      };
  };

  const browseObjects = (base) => {
      return (requestOptions) => {
          return createBrowsablePromise({
              ...requestOptions,
              shouldStop: response => response.cursor === undefined,
              request: (data) => base.transporter.read({
                  method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
                  path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/browse', base.indexName),
                  data,
              }, requestOptions),
          });
      };
  };

  const browseRules = (base) => {
      return (requestOptions) => {
          const options = {
              hitsPerPage: 1000,
              ...requestOptions,
          };
          return createBrowsablePromise({
              ...options,
              shouldStop: response => response.hits.length < options.hitsPerPage,
              request(data) {
                  return searchRules(base)('', { ...requestOptions, ...data }).then((response) => {
                      return {
                          ...response,
                          hits: response.hits.map(rule => {
                              // @ts-ignore
                              // eslint-disable-next-line functional/immutable-data,no-param-reassign
                              delete rule._highlightResult;
                              return rule;
                          }),
                      };
                  });
              },
          });
      };
  };

  const browseSynonyms = (base) => {
      return (requestOptions) => {
          const options = {
              hitsPerPage: 1000,
              ...requestOptions,
          };
          return createBrowsablePromise({
              ...options,
              shouldStop: response => response.hits.length < options.hitsPerPage,
              request(data) {
                  return searchSynonyms(base)('', { ...requestOptions, ...data }).then((response) => {
                      return {
                          ...response,
                          hits: response.hits.map(synonym => {
                              // @ts-ignore
                              // eslint-disable-next-line functional/immutable-data,no-param-reassign
                              delete synonym._highlightResult;
                              return synonym;
                          }),
                      };
                  });
              },
          });
      };
  };

  const chunkedBatch = (base) => {
      return (bodies, action, requestOptions) => {
          const { batchSize, ...options } = requestOptions || {};
          const response = {
              taskIDs: [],
              objectIDs: [],
          };
          const forEachBatch = (lastIndex = 0) => {
              // eslint-disable-next-line functional/prefer-readonly-type
              const bodiesChunk = [];
              // eslint-disable-next-line functional/no-let
              let index;
              /* eslint-disable-next-line functional/no-loop-statement */
              for (index = lastIndex; index < bodies.length; index++) {
                  // eslint-disable-next-line functional/immutable-data
                  bodiesChunk.push(bodies[index]);
                  if (bodiesChunk.length === (batchSize || 1000)) {
                      break;
                  }
              }
              if (bodiesChunk.length === 0) {
                  return Promise.resolve(response);
              }
              return batch(base)(bodiesChunk.map(body => {
                  return {
                      action,
                      body,
                  };
              }), options).then(res => {
                  response.objectIDs = response.objectIDs.concat(res.objectIDs); // eslint-disable-line functional/immutable-data
                  response.taskIDs.push(res.taskID); // eslint-disable-line functional/immutable-data
                  index++;
                  return forEachBatch(index);
              });
          };
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(forEachBatch(), (chunkedBatchResponse, waitRequestOptions) => {
              return Promise.all(chunkedBatchResponse.taskIDs.map(taskID => {
                  return waitTask(base)(taskID, waitRequestOptions);
              }));
          });
      };
  };

  const clearObjects = (base) => {
      return (requestOptions) => {
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/clear', base.indexName),
          }, requestOptions), (response, waitRequestOptions) => waitTask(base)(response.taskID, waitRequestOptions));
      };
  };

  const clearRules = (base) => {
      return (requestOptions) => {
          const { forwardToReplicas, ...options } = requestOptions || {};
          const mappedRequestOptions = Object(_algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["createMappedRequestOptions"])(options);
          if (forwardToReplicas) {
              mappedRequestOptions.queryParameters.forwardToReplicas = 1; // eslint-disable-line functional/immutable-data
          }
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/rules/clear', base.indexName),
          }, mappedRequestOptions), (response, waitRequestOptions) => waitTask(base)(response.taskID, waitRequestOptions));
      };
  };

  const clearSynonyms = (base) => {
      return (requestOptions) => {
          const { forwardToReplicas, ...options } = requestOptions || {};
          const mappedRequestOptions = Object(_algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["createMappedRequestOptions"])(options);
          if (forwardToReplicas) {
              mappedRequestOptions.queryParameters.forwardToReplicas = 1; // eslint-disable-line functional/immutable-data
          }
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/synonyms/clear', base.indexName),
          }, mappedRequestOptions), (response, waitRequestOptions) => waitTask(base)(response.taskID, waitRequestOptions));
      };
  };

  const deleteBy = (base) => {
      return (filters, requestOptions) => {
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/deleteByQuery', base.indexName),
              data: filters,
          }, requestOptions), (response, waitRequestOptions) => waitTask(base)(response.taskID, waitRequestOptions));
      };
  };

  const deleteIndex = (base) => {
      return (requestOptions) => {
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Delete,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s', base.indexName),
          }, requestOptions), (response, waitRequestOptions) => waitTask(base)(response.taskID, waitRequestOptions));
      };
  };

  const deleteObject = (base) => {
      return (objectID, requestOptions) => {
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(deleteObjects(base)([objectID], requestOptions).then(response => {
              return { taskID: response.taskIDs[0] };
          }), (response, waitRequestOptions) => waitTask(base)(response.taskID, waitRequestOptions));
      };
  };

  const deleteObjects = (base) => {
      return (objectIDs, requestOptions) => {
          const objects = objectIDs.map(objectID => {
              return { objectID };
          });
          return chunkedBatch(base)(objects, BatchActionEnum.DeleteObject, requestOptions);
      };
  };

  const deleteRule = (base) => {
      return (objectID, requestOptions) => {
          const { forwardToReplicas, ...options } = requestOptions || {};
          const mappedRequestOptions = Object(_algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["createMappedRequestOptions"])(options);
          if (forwardToReplicas) {
              mappedRequestOptions.queryParameters.forwardToReplicas = 1; // eslint-disable-line functional/immutable-data
          }
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Delete,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/rules/%s', base.indexName, objectID),
          }, mappedRequestOptions), (response, waitRequestOptions) => waitTask(base)(response.taskID, waitRequestOptions));
      };
  };

  const deleteSynonym = (base) => {
      return (objectID, requestOptions) => {
          const { forwardToReplicas, ...options } = requestOptions || {};
          const mappedRequestOptions = Object(_algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["createMappedRequestOptions"])(options);
          if (forwardToReplicas) {
              mappedRequestOptions.queryParameters.forwardToReplicas = 1; // eslint-disable-line functional/immutable-data
          }
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Delete,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/synonyms/%s', base.indexName, objectID),
          }, mappedRequestOptions), (response, waitRequestOptions) => waitTask(base)(response.taskID, waitRequestOptions));
      };
  };

  const exists = (base) => {
      return (requestOptions) => {
          return getSettings(base)(requestOptions)
              .then(() => true)
              .catch(error => {
              if (error.status !== 404) {
                  throw error;
              }
              return false;
          });
      };
  };

  const findObject = (base) => {
      return (callback, requestOptions) => {
          const { query, paginate, ...options } = requestOptions || {};
          // eslint-disable-next-line functional/no-let
          let page = 0;
          const forEachPage = () => {
              return search(base)(query || '', { ...options, page }).then(result => {
                  // eslint-disable-next-line functional/no-loop-statement
                  for (const [position, hit] of Object.entries(result.hits)) {
                      // eslint-disable-next-line promise/no-callback-in-promise
                      if (callback(hit)) {
                          return {
                              object: hit,
                              position: parseInt(position, 10),
                              page,
                          };
                      }
                  }
                  page++;
                  // paginate if option was set and has next page
                  if (paginate === false || page >= result.nbPages) {
                      throw createObjectNotFoundError();
                  }
                  return forEachPage();
              });
          };
          return forEachPage();
      };
  };

  const getObject = (base) => {
      return (objectID, requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Get,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/%s', base.indexName, objectID),
          }, requestOptions);
      };
  };

  const getObjectPosition = () => {
      return (searchResponse, objectID) => {
          // eslint-disable-next-line functional/no-loop-statement
          for (const [position, hit] of Object.entries(searchResponse.hits)) {
              if (hit.objectID === objectID) {
                  return parseInt(position, 10);
              }
          }
          return -1;
      };
  };

  const getObjects = (base) => {
      return (objectIDs, requestOptions) => {
          const { attributesToRetrieve, ...options } = requestOptions || {};
          const requests = objectIDs.map(objectID => {
              return {
                  indexName: base.indexName,
                  objectID,
                  ...(attributesToRetrieve ? { attributesToRetrieve } : {}),
              };
          });
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: '1/indexes/*/objects',
              data: {
                  requests,
              },
          }, options);
      };
  };

  const getRule = (base) => {
      return (objectID, requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Get,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/rules/%s', base.indexName, objectID),
          }, requestOptions);
      };
  };

  const getSettings = (base) => {
      return (requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Get,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/settings', base.indexName),
              data: {
                  getVersion: 2,
              },
          }, requestOptions);
      };
  };

  const getSynonym = (base) => {
      return (objectID, requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Get,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])(`1/indexes/%s/synonyms/%s`, base.indexName, objectID),
          }, requestOptions);
      };
  };

  const getTask = (base) => {
      return (taskID, requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Get,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/task/%s', base.indexName, taskID.toString()),
          }, requestOptions);
      };
  };

  const partialUpdateObject = (base) => {
      return (object, requestOptions) => {
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(partialUpdateObjects(base)([object], requestOptions).then(response => {
              return {
                  objectID: response.objectIDs[0],
                  taskID: response.taskIDs[0],
              };
          }), (response, waitRequestOptions) => waitTask(base)(response.taskID, waitRequestOptions));
      };
  };

  const partialUpdateObjects = (base) => {
      return (objects, requestOptions) => {
          const { createIfNotExists, ...options } = requestOptions || {};
          const action = createIfNotExists
              ? BatchActionEnum.PartialUpdateObject
              : BatchActionEnum.PartialUpdateObjectNoCreate;
          return chunkedBatch(base)(objects, action, options);
      };
  };

  const replaceAllObjects = (base) => {
      return (objects, requestOptions) => {
          const { safe, autoGenerateObjectIDIfNotExist, batchSize, ...options } = requestOptions || {};
          const operation = (from, to, type, operationRequestOptions) => {
              return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(base.transporter.write({
                  method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
                  path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/operation', from),
                  data: {
                      operation: type,
                      destination: to,
                  },
              }, operationRequestOptions), (response, waitRequestOptions) => waitTask(base)(response.taskID, waitRequestOptions));
          };
          const randomSuffix = Math.random()
              .toString(36)
              .substring(7);
          const temporaryIndexName = `${base.indexName}_tmp_${randomSuffix}`;
          const saveObjectsInTemporary = saveObjects({
              appId: base.appId,
              transporter: base.transporter,
              indexName: temporaryIndexName,
          });
          // @ts-ignore
          // eslint-disable-next-line prefer-const, functional/no-let, functional/prefer-readonly-type
          let responses = [];
          const copyWaitablePromise = operation(base.indexName, temporaryIndexName, 'copy', {
              ...options,
              scope: ['settings', 'synonyms', 'rules'],
          });
          // eslint-disable-next-line functional/immutable-data
          responses.push(copyWaitablePromise);
          const result = (safe
              ? copyWaitablePromise.wait(options)
              : copyWaitablePromise)
              .then(() => {
              const saveObjectsWaitablePromise = saveObjectsInTemporary(objects, {
                  ...options,
                  autoGenerateObjectIDIfNotExist,
                  batchSize,
              });
              // eslint-disable-next-line functional/immutable-data
              responses.push(saveObjectsWaitablePromise);
              return safe ? saveObjectsWaitablePromise.wait(options) : saveObjectsWaitablePromise;
          })
              .then(() => {
              const moveWaitablePromise = operation(temporaryIndexName, base.indexName, 'move', options);
              // eslint-disable-next-line functional/immutable-data
              responses.push(moveWaitablePromise);
              return safe ? moveWaitablePromise.wait(options) : moveWaitablePromise;
          })
              .then(() => Promise.all(responses))
              .then(([copyResponse, saveObjectsResponse, moveResponse]) => {
              return {
                  objectIDs: saveObjectsResponse.objectIDs,
                  taskIDs: [copyResponse.taskID, ...saveObjectsResponse.taskIDs, moveResponse.taskID],
              };
          });
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(result, (_, waitRequestOptions) => {
              return Promise.all(responses.map(response => response.wait(waitRequestOptions)));
          });
      };
  };

  const replaceAllRules = (base) => {
      return (rules, requestOptions) => {
          return saveRules(base)(rules, {
              ...requestOptions,
              clearExistingRules: true,
          });
      };
  };

  const replaceAllSynonyms = (base) => {
      return (synonyms, requestOptions) => {
          return saveSynonyms(base)(synonyms, {
              ...requestOptions,
              replaceExistingSynonyms: true,
          });
      };
  };

  const saveObject = (base) => {
      return (object, requestOptions) => {
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(saveObjects(base)([object], requestOptions).then(response => {
              return {
                  objectID: response.objectIDs[0],
                  taskID: response.taskIDs[0],
              };
          }), (response, waitRequestOptions) => waitTask(base)(response.taskID, waitRequestOptions));
      };
  };

  const saveObjects = (base) => {
      return (objects, requestOptions) => {
          const { autoGenerateObjectIDIfNotExist, ...options } = requestOptions || {};
          const action = autoGenerateObjectIDIfNotExist
              ? BatchActionEnum.AddObject
              : BatchActionEnum.UpdateObject;
          if (action === BatchActionEnum.UpdateObject) {
              // eslint-disable-next-line functional/no-loop-statement
              for (const object of objects) {
                  if (object.objectID === undefined) {
                      return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(Promise.reject(createMissingObjectIDError()));
                  }
              }
          }
          return chunkedBatch(base)(objects, action, options);
      };
  };

  const saveRule = (base) => {
      return (rule, requestOptions) => {
          return saveRules(base)([rule], requestOptions);
      };
  };

  const saveRules = (base) => {
      return (rules, requestOptions) => {
          const { forwardToReplicas, clearExistingRules, ...options } = requestOptions || {};
          const mappedRequestOptions = Object(_algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["createMappedRequestOptions"])(options);
          if (forwardToReplicas) {
              mappedRequestOptions.queryParameters.forwardToReplicas = 1; // eslint-disable-line functional/immutable-data
          }
          if (clearExistingRules) {
              mappedRequestOptions.queryParameters.clearExistingRules = 1; // eslint-disable-line functional/immutable-data
          }
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/rules/batch', base.indexName),
              data: rules,
          }, mappedRequestOptions), (response, waitRequestOptions) => waitTask(base)(response.taskID, waitRequestOptions));
      };
  };

  const saveSynonym = (base) => {
      return (synonym, requestOptions) => {
          return saveSynonyms(base)([synonym], requestOptions);
      };
  };

  const saveSynonyms = (base) => {
      return (synonyms, requestOptions) => {
          const { forwardToReplicas, replaceExistingSynonyms, ...options } = requestOptions || {};
          const mappedRequestOptions = Object(_algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["createMappedRequestOptions"])(options);
          if (forwardToReplicas) {
              mappedRequestOptions.queryParameters.forwardToReplicas = 1; // eslint-disable-line functional/immutable-data
          }
          if (replaceExistingSynonyms) {
              mappedRequestOptions.queryParameters.replaceExistingSynonyms = 1; // eslint-disable-line functional/immutable-data
          }
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/synonyms/batch', base.indexName),
              data: synonyms,
          }, mappedRequestOptions), (response, waitRequestOptions) => waitTask(base)(response.taskID, waitRequestOptions));
      };
  };

  const search = (base) => {
      return (query, requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/query', base.indexName),
              data: {
                  query,
              },
              cacheable: true,
          }, requestOptions);
      };
  };

  const searchForFacetValues = (base) => {
      return (facetName, facetQuery, requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/facets/%s/query', base.indexName, facetName),
              data: {
                  facetQuery,
              },
              cacheable: true,
          }, requestOptions);
      };
  };

  const searchRules = (base) => {
      return (query, requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/rules/search', base.indexName),
              data: {
                  query,
              },
          }, requestOptions);
      };
  };

  const searchSynonyms = (base) => {
      return (query, requestOptions) => {
          return base.transporter.read({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Post,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/synonyms/search', base.indexName),
              data: {
                  query,
              },
          }, requestOptions);
      };
  };

  const setSettings = (base) => {
      return (settings, requestOptions) => {
          const { forwardToReplicas, ...options } = requestOptions || {};
          const mappedRequestOptions = Object(_algolia_transporter__WEBPACK_IMPORTED_MODULE_1__["createMappedRequestOptions"])(options);
          if (forwardToReplicas) {
              mappedRequestOptions.queryParameters.forwardToReplicas = 1; // eslint-disable-line functional/immutable-data
          }
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createWaitablePromise"])(base.transporter.write({
              method: _algolia_requester_common__WEBPACK_IMPORTED_MODULE_2__["MethodEnum"].Put,
              path: Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["encode"])('1/indexes/%s/settings', base.indexName),
              data: settings,
          }, mappedRequestOptions), (response, waitRequestOptions) => waitTask(base)(response.taskID, waitRequestOptions));
      };
  };

  const waitTask = (base) => {
      return (taskID, requestOptions) => {
          return Object(_algolia_client_common__WEBPACK_IMPORTED_MODULE_0__["createRetryablePromise"])(retry => {
              return getTask(base)(taskID, requestOptions).then(response => {
                  return response.status !== 'published' ? retry() : undefined;
              });
          });
      };
  };

  const BatchActionEnum = {
      AddObject: 'addObject',
      UpdateObject: 'updateObject',
      PartialUpdateObject: 'partialUpdateObject',
      PartialUpdateObjectNoCreate: 'partialUpdateObjectNoCreate',
      DeleteObject: 'deleteObject',
  };

  const ScopeEnum = {
      Settings: 'settings',
      Synonyms: 'synonyms',
      Rules: 'rules',
  };

  const StrategyEnum = {
      None: 'none',
      StopIfEnoughMatches: 'stopIfEnoughMatches',
  };

  const SynonymEnum = {
      Synonym: 'synonym',
      OneWaySynonym: 'oneWaySynonym',
      AltCorrection1: 'altCorrection1',
      AltCorrection2: 'altCorrection2',
      Placeholder: 'placeholder',
  };




  /***/ }),
  /* 14 */
  /***/ (function(module, exports) {

  module.exports = require("crypto");

  /***/ }),
  /* 15 */
  /***/ (function(module, __webpack_exports__, __webpack_require__) {

  "use strict";
  __webpack_require__.r(__webpack_exports__);
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "LogLevelEnum", function() { return LogLevelEnum; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createNullLogger", function() { return createNullLogger; });
  function createNullLogger() {
      return {
          debug(_message, _args) {
              return Promise.resolve();
          },
          info(_message, _args) {
              return Promise.resolve();
          },
          error(_message, _args) {
              return Promise.resolve();
          },
      };
  }

  const LogLevelEnum = {
      Debug: 1,
      Info: 2,
      Error: 3,
  };




  /***/ }),
  /* 16 */
  /***/ (function(module, __webpack_exports__, __webpack_require__) {

  "use strict";
  __webpack_require__.r(__webpack_exports__);
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "createNodeHttpRequester", function() { return createNodeHttpRequester; });
  /* harmony import */ var http__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(17);
  /* harmony import */ var http__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(http__WEBPACK_IMPORTED_MODULE_0__);
  /* harmony import */ var https__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(18);
  /* harmony import */ var https__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(https__WEBPACK_IMPORTED_MODULE_1__);
  /* harmony import */ var url__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(19);
  /* harmony import */ var url__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(url__WEBPACK_IMPORTED_MODULE_2__);






  /* eslint sonarjs/cognitive-complexity: 0 */ // -->
  function createNodeHttpRequester() {
      const agentOptions = { keepAlive: true };
      const httpAgent = new http__WEBPACK_IMPORTED_MODULE_0__["Agent"](agentOptions);
      const httpsAgent = new https__WEBPACK_IMPORTED_MODULE_1__["Agent"](agentOptions);
      return {
          send(request) {
              return new Promise(resolve => {
                  const url = Object(url__WEBPACK_IMPORTED_MODULE_2__["parse"])(request.url);
                  const path = url.query === null ? url.pathname : `${url.pathname}?${url.query}`;
                  const options = {
                      agent: url.protocol === 'https:' ? httpsAgent : httpAgent,
                      hostname: url.hostname,
                      path,
                      method: request.method,
                      headers: request.headers,
                      ...(url.port !== undefined ? { port: url.port || '' } : {}),
                  };
                  const req = (url.protocol === 'https:' ? https__WEBPACK_IMPORTED_MODULE_1__ : http__WEBPACK_IMPORTED_MODULE_0__).request(options, response => {
                      // eslint-disable-next-line functional/no-let
                      let content = '';
                      response.on('data', chunk => (content += chunk));
                      response.on('end', () => {
                          // eslint-disable-next-line @typescript-eslint/no-use-before-define
                          clearTimeout(connectTimeout);
                          // eslint-disable-next-line @typescript-eslint/no-use-before-define
                          clearTimeout(responseTimeout);
                          resolve({
                              status: response.statusCode || 0,
                              content,
                              isTimedOut: false,
                          });
                      });
                  });
                  const createTimeout = (timeout, content) => {
                      return setTimeout(() => {
                          req.abort();
                          resolve({
                              status: 0,
                              content,
                              isTimedOut: true,
                          });
                      }, timeout * 1000);
                  };
                  const connectTimeout = createTimeout(request.connectTimeout, 'Connection timeout');
                  // eslint-disable-next-line functional/no-let
                  let responseTimeout;
                  req.on('error', error => {
                      clearTimeout(connectTimeout);
                      clearTimeout(responseTimeout);
                      resolve({ status: 0, content: error.message, isTimedOut: false });
                  });
                  req.once('response', () => {
                      clearTimeout(connectTimeout);
                      responseTimeout = createTimeout(request.responseTimeout, 'Socket timeout');
                  });
                  if (request.data !== undefined) {
                      req.write(request.data);
                  }
                  req.end();
              });
          },
          destroy() {
              httpAgent.destroy();
              httpsAgent.destroy();
              return Promise.resolve();
          },
      };
  }




  /***/ }),
  /* 17 */
  /***/ (function(module, exports) {

  module.exports = require("http");

  /***/ }),
  /* 18 */
  /***/ (function(module, exports) {

  module.exports = require("https");

  /***/ }),
  /* 19 */
  /***/ (function(module, exports) {

  module.exports = require("url");

  /***/ })
  /******/ ]);
    return plugin;
  },
};
