
    
function trace(msg, obj) {
  console.info(`${msg}`);
  console.log(obj);
}


module.exports = {
  name: `plugin-local-cache`,
  factory: (require) => {

    const cachePath = '.yarn/packages'; // TODO update to get this from config instead of hard coded
    let index = undefined;

    let scanPromise = undefined;
    async function initializePackageCache() {
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
                manifest = {
                  name: 'scratch',
                  version: '0.0.0',
                };
                console.warn('skipped extracting .tgz file and used a fake manifest since "tar" is not currently requirable in plugins');
                // TODO delete the above and uncomment the following
                // manifest = JSON.parse(await extractTarFile(location, 'package/package.json'));
                // manifest.url = `file:${location}`;
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
        const tar = require('tar');
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
        //trace('called supportsDescriptor', {descriptor, opts});
        await initializePackageCache();
        const result = await next();
        return result;
      }
      async supportsLocator(locator, opts, next, protocols) {
        //trace('called supportsLocator, {locator, opts});
        await initializePackageCache();
        const result = await next();
        return result;
      }
      async shouldPersistResolution(locator, opts, next, protocols) {
        trace('called shouldPersistResolution', {locator, opts});
        await initializePackageCache();
        const result = await next();
        return result;
      }
      async bindDescriptor(descriptor, fromLocator, opts, next, protocols) {
        trace('called bindDescriptor', {descriptor, fromLocator, opts});
        await initializePackageCache();
        const result = await next();
        return result;
      }
      async getResolutionDependencies(descriptor, opts, next, protocols) {
        trace('called getResolutionDependencies', {descriptor, opts});
        await initializePackageCache();
        const result = await next();
        return result;
      }
      async getCandidates(descriptor, dependencies, opts, next, protocols) {
        trace('called getCandidates', {descriptor, dependencies, opts});
        await initializePackageCache();
        const result = await next();
        return result;
      }
      async resolve(locator, opts, next, protocols) {
        trace('called resolve', {locator, opts});
        await initializePackageCache();
        const result = await next();
        return result;
      }
    }

    class CachingFetcher {
      constructor() {
        this.type = 'module';
      }
      async supports(locator, opts, next, protocols) {
        trace('called supports', {locator, opts});
        await initializePackageCache();
        return await next();
      }
      async getLocalPath(locator, opts, next, protocols) {
        trace('called getLocalPath', {locator, opts});
        await initializePackageCache();
        return await next();
      }
      async fetch(locator, opts, next, protocols) {
        trace('called fetch', {locator, opts});
        await initializePackageCache();
        return await next();
      }
    }

    // const {Command} = require(`clipanion`);

    // class HelloWorldCommand extends Command {
    //   async execute() {
    //     this.context.stdout.write(`This is my very own plugin 😎\n`);
    //   }
    // }
    
    // HelloWorldCommand.addPath(`hello`);

    return {
      resolvers: [CachingResolver],
      fetchers: [CachingFetcher],
      // commands: [HelloWorldCommand],
    };
  },
};