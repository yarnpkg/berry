//const tar = require('tar'); // note that tar had to be added to yarn top level workspace to get it requirable here
// it threw an error when trying to require it from within the factory method below

module.exports = {
  name: `plugin-local-cache`,
  factory: (yarnRequire) => {
    const cachePath = '.yarn/packages'; // TODO update to get this from config instead of hard coded
    let index = undefined;
    //const tar = yarnRequire('tar');

    let scanPromise = undefined;
    async function initializePackageCache() {
      return;
      if (!scanPromise) scanPromise = scanPackageCache(cachePath);
      const result = await scanPromise;
      if (!index) index = result;
    }

    function scanPackageCache(cachePath='packages') {
      const fs = require('fs');
      const path = require('path');
      console.info('scanning package cache at %s', cachePath);
      return new Promise( async (resolve, reject) => {
        const index = {};
        try {
          for await (const dirent of await fs.promises.opendir(cachePath)) {
            if (! dirent.name.startsWith('.')) {
              const location = path.join(cachePath, dirent.name);
              let manifest;
              if (dirent.isDirectory()) {
                // TODO consider adding logic to check whether package is inside a package folder instead of at the top level
                manifest = JSON.parse(await fs.promises.readFile(path.join(location, 'package.json'), 'utf8'));
                manifest.url = `portal:${location}`;
              } else if (dirent.isFile() && dirent.name.endsWith('.tgz')) {
                manifest = JSON.parse(await extractTarFile(location, 'package/package.json'));
                manifest.url = `file:${location}`;
              }
              if (!manifest || !manifest.name || !manifest.version) throw new Error(`error: invalid manifest for ${location}`);
              if (!index[manifest.name]) index[manifest.name] = {};
              index[manifest.name][manifest.version] = manifest;
              console.info('added package %s-%s to the package cache from %s', manifest.name, manifest.version, manifest.url);
            }
          }
        } catch (error) {
          if (error.code === 'ENOENT') {
            console.info('no package cache found at %s', cachePath);
          } else {
            console.error(error);
            reject(error);
          }
        }
        resolve(index);
      } );

      function extractTarFile(source, filename) {
        return new Promise( (resolve, reject) => {
          try {
            fs.createReadStream(source).pipe(new tar.Parse({
              filter: (path) => path === filename,
              onentry: (entry) => entry.on('data', (data) => resolve(data) ),
            }));
          } catch (error) {
            reject(error);
          }
        } );
      }
    }
    
    class CachingResolver {
      constructor() {
        this.type = 'module';
      }
      async supportsDescriptor(descriptor, opts, next, protocols) {
        // console.log('called supportsDescription');
        await initializePackageCache();
        return await next();
      }
      async supportsLocator(locator, opts, next, protocols) {
        // console.log('called supportsLocator');
        await initializePackageCache();
        return await next();
      }
      async shouldPersistResolution(locator, opts, next, protocols) {
        // console.log('called shouldPersistResolution');
        await initializePackageCache();
        return await next();
      }
      async bindDescriptor(descriptor, fromLocator, opts, next, protocols) {
        // console.log('called bindDescriptor');
        await initializePackageCache();
        return await next();
      }
      async getResolutionDependencies(descriptor, opts, next, protocols) {
        // console.log('called getResolutionDependencies');
        await initializePackageCache();
        return await next();
      }
      async getCandidates(descriptor, dependencies, opts, next, protocols) {
        // console.log('called getCandidates');
        await initializePackageCache();
        return await next();
      }
      async resolve(locator, opts, next, protocols) {
        // console.log('called resolve');
        await initializePackageCache();
        return await next();
      }
    }

    class CachingFetcher {
      constructor() {
        this.type = 'module';
      }
      async supports(locator, opts, next, protocols) {
        // console.log('called supports');
        await initializePackageCache();
        return await next();
      }
      async getLocalPath(locator, opts, next, protocols) {
        // console.log('called getLocalPath');
        await initializePackageCache();
        return await next();
      }
      async fetch(locator, opts, next, protocols) {
        // console.log('called fetch');
        await initializePackageCache();
        return await next();
      }
    }
    return {
      resolvers: [CachingResolver],
      fetchers: [CachingFetcher],
    };
  },
};