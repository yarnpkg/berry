import React                                    from 'react';

import Layout                                   from '../../components/layout-configuration';
import {SymlContainer, SymlMain, SymlArrayProperty, SymlScalar}                from '../../components/syml';
import {SymlObjectProperty, SymlScalarProperty} from '../../components/syml';
import SEO                                      from '../../components/seo';

const YarnrcDoc = () => <>
  <Layout>
    <SEO
      title={`Configuration options`}
      description={`List of all the configuration option for Yarn (yarnrc files)`}
      keywords={[`package manager`, `yarn`, `yarnpkg`, `configuration`, `yarnrc`]}
    />
    <SymlContainer>
      <SymlMain>
        <p>Yarnrc files (named this way because they must be called <code>.yarnrc.yml</code>) are the one place where you'll be able to configure Yarn's internal settings. While Yarn will automatically find them in the parent directories, they should usually be kept at the root of your project (often your repository). Starting from the v2, they <b>must</b> be written in valid Yaml and have the right extension (simply calling your file <code>.yarnrc</code> won't do).</p>
        <p>Those settings can also be defined through environment variables (at least for the simpler ones; arrays and objects aren't supported yet). To do this, just prefix the names and write them in snake case: <code>YARN_CACHE_FOLDER</code> will set the cache folder (such values will overwrite any that might have been defined in the RC files - use them sparingly).</p>
      </SymlMain>
      <SymlScalarProperty
        name={`bstatePath`}
        placeholder={`./.yarn/build-state.yml`}
        description={<>
          This setting defines the location where the bstate file will be stored. The bstate file contains the current build state of each package that has build requirements in your dependencies. Removing the bstate file is safe, but will cause all your packages to be rebuilt.
        </>}
      />
      <SymlScalarProperty
        name={`cacheFolder`}
        placeholder={`./.yarn/cache`}
        description={<>
          The path where the downloaded packages are stored on your system. They'll be normalized, compressed, and saved under the form of zip archives with standardized names. The cache is deemed to be relatively safe to be shared by multiple projects, even when multiple Yarn instances run at the same time on different projects.
        </>}
      />
      <SymlScalarProperty
        name={`checksumBehavior`}
        placeholder={`throw`}
        description={<>
          If <code>throw</code> (the default), Yarn will throw an exception on <code>yarn install</code> if it detects that a package doesn't match the checksum stored within the lockfile. If <code>update</code>, the lockfile checksum will be updated to match the new value. If <code>ignore</code>, the checksum check will not happen.
        </>}
      />
      <SymlScalarProperty
        name={`defaultProtocol`}
        placeholder={`npm:`}
        description={<>
          Yarn is a modular package manager that can resolve packages from various sources. As such, semver ranges and tag names don't only work with the npm registry - just change the default protocol to something else and your semver ranges will be fetched from whatever source you select.
        </>}
      />
      <SymlScalarProperty
        name={`defaultSemverRangePrefix`}
        placeholder={`^`}
        description={<>
          The default prefix for semantic version dependency ranges, which is used for new dependencies that are installed to a manifest. Possible values are <code>"^"</code> (the default), <code>"~"</code> or <code>""</code>.
        </>}
      />
      <SymlScalarProperty
        name={`enableColors`}
        placeholder={true}
        description={<>
          If true, Yarn will format its pretty-print its output by using colors to differentiate important parts of its messages.
        </>}
      />
      <SymlScalarProperty
        name={`enableGlobalCache`}
        placeholder={false}
        description={<>
          If true, Yarn will disregard the <code>cacheFolder</code> settings and will store the cache files into a folder shared by all local projects sharing the same configuration.
        </>}
      />
      <SymlScalarProperty
        name={`enableImmutableCache`}
        placeholder={false}
        description={<>
          If true, Yarn will refuse the change the cache in any way (whether it would add files or remove them) when running <code>yarn install</code>.
        </>}
      />
      <SymlScalarProperty
        name={`enableImmutableInstalls`}
        placeholder={false}
        description={<>
          If true, Yarn will refuse to change the installation artifacts (apart the cache) when running an install. This flag is quite intrusive, you typically should only set it on your CI by manually passing the <code>--immutable</code> flag to <code>yarn install</code>.
        </>}
      />
      <SymlScalarProperty
        name={`enableInlineBuilds`}
        placeholder={false}
        description={<>
          If true, Yarn will print the build output directly within the terminal instead of buffering it in a log file. This is the default for CI environments.
        </>}
      />
      <SymlScalarProperty
        name={`enableMirror`}
        placeholder={true}
        description={<>
          If enabled (which is the default), Yarn will use the global folder as indirection between the network and the actual cache. This makes installs much faster for projects that don't already benefit from Zero-Installs.
        </>}
      />
      <SymlScalarProperty
        name={`enableNetwork`}
        placeholder={true}
        description={<>
          If disabled, Yarn will never make any request to the network by itself, and will throw an exception rather than let it happen. It's a very useful setting for CI, which typically want to make sure they aren't loading their dependencies from the network by mistake.
        </>}
      />
      <SymlScalarProperty
        name={`enableProgressBars`}
        placeholder={true}
        description={<>
          If true, Yarn will show progress bars for long-running events. It's disabled by default for CI environments.
        </>}
      />
      <SymlScalarProperty
        name={`enableScripts`}
        placeholder={false}
        description={<>
          If disabled, Yarn will not execute the <code>postInstall</code> scripts when installing the project. Note that you can now also disable scripts on a per-package basis thanks to <code>dependenciesMeta</code>.
        </>}
      />
      <SymlScalarProperty
        name={`enableTimers`}
        placeholder={true}
        description={<>
          If true, Yarn will print the time spent running each sub-step when running various commands. Disabling this feature is typically needed for testing purposes, when you want each execution to have exactly the same output as the previous ones.
        </>}
      />
      <SymlScalarProperty
        name={`enableTransparentWorkspaces`}
        placeholder={false}
        description={<>
          If disabled, Yarn won't anymore link workspaces just because their versions happen to match a semver range. Using this setting will require that all workspace accesses are made through the <code>workspace:</code> protocol. This is usually only needed in some very specific circumstances.
        </>}
      />
      <SymlScalarProperty
        name={`globalFolder`}
        placeholder={`./.yarn/global`}
        description={<>
          The path where all system-global files (for example the list of all packages registered through <code>yarn link</code>) are stored.
        </>}
      />
      <SymlScalarProperty
        name={`httpProxy`}
        placeholder={`http://proxy:4040`}
        description={<>
          Defines a proxy to use when making an HTTP request. Note that Yarn only supports HTTP proxies at the moment (help welcome!).
        </>}
      />
      <SymlScalarProperty
        name={`httpsProxy`}
        placeholder={`http://proxy:4040`}
        description={<>
          Defines a proxy to use when making an HTTPS request. Note that Yarn only supports HTTP proxies at the moment (help welcome!).
        </>}
      />
      <SymlScalarProperty
        name={`lockfileFilename`}
        placeholder={`yarn.lock`}
        description={<>
          Defines the name of the lockfiles that will be generated by Yarn.
        </>}
      />
      <SymlScalarProperty
        name={`npmAlwaysAuth`}
        placeholder={`true`}
        description={<>
          If true, Yarn will always send the authentication credentials when making a request to the registries. This typically shouldn't be needed.
        </>}
      />
      <SymlScalarProperty
        name={`npmAuthIdent`}
        placeholder={`username:password`}
        description={<>
          Defines the authentication credentials to use by default when accessing your registries (equivalent to <code>_auth</code> in the v1). This settings is strongly discouraged in favor of <a href={`#npmAuthToken`}><code>npmAuthToken</code></a>.
        </>}
      />
      <SymlScalarProperty
        name={`npmAuthToken`}
        placeholder={`ffffffff-ffff-ffff-ffff-ffffffffffff`}
        description={<>
          Defines the authentication credentials to use by default when accessing your registries (equivalent to <code>_authToken</code> in the v1). If you're using <a href={`#npmScopes`}><code>npmScopes</code></a> to define multiple registries, the <a href={`#npmServer`}><code>npmServer</code></a> dictionary allows you to override these credentials on a per-registry basis.
        </>}
      />
      <SymlScalarProperty
        name={`npmPublishAccess`}
        placeholder={`public`}
        description={<>
          Defines the default access to use when publishing packages to the npm registry. Valid values are <code>public</code> and <code>restricted</code>, but <code>restricted</code> usually requires to register for a paid plan (this is up to the registry you use).
        </>}
      />
      <SymlScalarProperty
        name={`npmPublishRegistry`}
        placeholder={`https://npm.pkg.github.com`}
        description={<>
          Defines the registry that must be used when pushing packages. Doesn't need to be defined, in which case the value of <code>npmRegistryServer</code> will be used. Overridden by <code>publishConfig.registry</code>.
        </>}
      />
      <SymlObjectProperty
        name={`npmRegistries`}
        margin={true}
        description={<>
          On top of the global configuration, registries can be configured on a per-scope basis (for example to instruct Yarn to use your private registry when accessing packages from a given scope). The following properties are supported:
        </>}
      >
        <SymlObjectProperty
          name={`//npm.pkg.github.com`}
          margin={true}
          description={<>
            This key represent the registry that's covered by the settings defined in the nested object. The protocol is optional (using <code>https://npm.pkg.github.com</code> would work just as well).
          </>}
        >
          <SymlScalarProperty
            name={`npmAlwaysAuth`}
            anchor={`npmRegistries.npmAlwaysAuth`}
            placeholder={true}
            description={<>
              See <a href={`#npmAlwaysAuth`}><code>npmAlwaysAuth</code></a>.
            </>}
          />
          <SymlScalarProperty
            name={`npmAuthIdent`}
            anchor={`npmRegistries.npmAuthIdent`}
            placeholder={`username:password`}
            description={<>
              See <a href={`#npmAuthIdent`}><code>npmAuthIdent</code></a>.
            </>}
          />
          <SymlScalarProperty
            name={`npmAuthToken`}
            anchor={`npmRegistries.npmAuthToken`}
            placeholder={`ffffffff-ffff-ffff-ffff-ffffffffffff`}
            description={<>
              See <a href={`#npmAuthToken`}><code>npmAuthToken</code></a>.
            </>}
          />
        </SymlObjectProperty>
      </SymlObjectProperty>
      <SymlScalarProperty
        name={`npmRegistryServer`}
        placeholder={`https://registry.yarnpkg.com`}
        description={<>
          Defines the hostname of the remote server from where Yarn should fetch the metadata and archives when querying the npm registry. Should you want to define different registries for different scopes, see <a href={`#npmScopes`}><code>npmScopes</code></a>. To define the authentication scheme for your servers, see <a href={`#npmAuthToken`}><code>npmAuthToken</code></a>.
        </>}
      />
      <SymlObjectProperty
        name={`npmScopes`}
        margin={true}
        description={<>
          On top of the global configuration, registries can be configured on a per-scope basis (for example to instruct Yarn to use your private registry when accessing packages from a given scope). The following properties are supported:
        </>}
      >
        <SymlObjectProperty
          name={`my-company`}
          margin={true}
          description={<>
            This key represent the scope that's covered by the settings defined in the nested object. Note that it mustn't start with the <code>@</code> character.
          </>}
        >
          <SymlScalarProperty
            name={`npmPublishRegistry`}
            anchor={`npmScopes.npmPublishRegistry`}
            placeholder={`https://registry.yarnpkg.com`}
            description={<>
              See <a href={`#npmPublishRegistry`}><code>npmPublishRegistry</code></a>.
            </>}
          />
          <SymlScalarProperty
            name={`npmRegistryServer`}
            anchor={`npmScopes.npmRegistryServer`}
            placeholder={`https://registry.yarnpkg.com`}
            description={<>
              See <a href={`#npmRegistryServer`}><code>npmRegistryServer</code></a>.
            </>}
          />
        </SymlObjectProperty>
      </SymlObjectProperty>
      <SymlObjectProperty
        name={`packageExtensions`}
        margin={true}
        description={<>
          Some packages may have been specified incorrectly with regard to their dependencies - for example with one dependency being missing, causing Yarn to refuse it the access. The <code>packageExtensions</code> fields offer a way to extend the existing package definitions with additional information.
        </>}
      >
        <SymlObjectProperty
          name={`webpack@*`}
          description={<>
            Each key is a descriptor covering a semver range. The extensions will be applied to any package whose version matches the specified range. This is true regardless of where the package comes from, so no distinction on whether they come from git or a registry, for example. Only the version matters.
          </>}
        >
          <SymlObjectProperty
            name={`dependencies`}
            anchor={`packageExtensions.dependencies`}
          >
            <SymlScalarProperty
              name={`lodash`}
              placeholder={`^4.15.0`}
            />
          </SymlObjectProperty>
          <SymlObjectProperty
            name={`peerDependencies`}
            anchor={`packageExtensions.peerDependencies`}
          >
            <SymlScalarProperty
              name={`webpack-cli`}
              placeholder={`*`}
            />
          </SymlObjectProperty>
        </SymlObjectProperty>
      </SymlObjectProperty>
      <SymlScalarProperty
        name={`pnpDataPath`}
        placeholder={`./.pnp.meta.json`}
        description={<>
          The location where Yarn will read and write the <code>.pnp.meta.json</code> file.
        </>}
      />
      <SymlScalarProperty
        name={`pnpEnableInlining`}
        placeholder={`true`}
        description={<>
          If true (the default), Yarn will generate a single <code>.pnp.js</code> file that contains all the required data for your project to work properly. If toggled off, Yarn will also generate a <code>.pnp.data.json</code> file meant to be consumed by the <code>@yarnpkg/pnp</code> package.
        </>}
      />
      <SymlScalarProperty
        name={`pnpFallbackMode`}
        placeholder={`dependencies-only`}
        description={<>
          Enumeration whose values (<code>none</code>, <code>dependencies-only</code>, <code>all</code>) defines in which capacity should the PnP hook allow packages to rely on the builtin fallback mechanism. In <code>dependencies-only</code> mode (the default), your workspaces aren't allowed to use it.
        </>}
      />
      <SymlScalarProperty
        name={`pnpIgnorePattern`}
        placeholder={`^\\./subdir/.*`}
        description={<>
          Files matching the following location (in term of relative path compared to the generated <code>.pnp.js</code> file) will not be covered by PnP and will use the regular Node resolution. Typically only needed if you have subprojects that aren't yet part of your workspace tree.
        </>}
      />
      <SymlScalarProperty
        name={`pnpShebang`}
        placeholder={`#!/usr/bin/env node`}
        description={<>
          A header that will be prepended to the generated <code>.pnp.js</code> file. You're allowed to write multiple lines, but this is slightly frowned upon.
        </>}
      />
      <SymlScalarProperty
        name={`pnpUnpluggedFolder`}
        placeholder={`./yarn/unplugged`}
        description={<>
          The path where unplugged packages will be stored on the disk.
        </>}
      />
      <SymlScalarProperty
        name={`preferDeferredVersions`}
        placeholder={false}
        description={<>
          If true, Yarn will use the deferred versioning (<code>--deferred</code>) by default when running the <code>yarn version</code> family of commands. This can be overruled on a by-command basis by manually setting the <code>--immediate</code> flag.
        </>}
      />
      <SymlScalarProperty
        name={`preferInteractive`}
        placeholder={true}
        description={<>
          If true, Yarn will ask for your guidance when some actions would be improved by being disambiguated. Enabling this setting also unlocks some features (for example the <code>yarn add</code> command will suggest to reuse the same dependencies as other workspaces if pertinent).
        </>}
      />
      <SymlScalarProperty
        name={`rcFilename`}
        placeholder={`.yarnrc.yml`}
        description={<>
          This setting defines the name of the files that Yarn looks for when resolving the rc files. For obvious reasons this settings cannot be set within rc files, and must be defined in the environment using the <code>YARN_RC_FILENAME</code> variable.
        </>}
      />
      <SymlArrayProperty
        name={`unsafeHttpWhitelist`}
        description={<>
          This setting lists the hostnames for which using the HTTP protocol is allowed. Any other hostname will be required to use HTTPS instead.
        </>}
      >
        <SymlScalar
          placeholder={`*.example.org`}
        />
        <SymlScalar
          placeholder={`example.org`}
        />
      </SymlArrayProperty>
      <SymlScalarProperty
        name={`virtualFolder`}
        placeholder={`./.yarn/$$virtual`}
        description={<>
          Due to a particularity in how Yarn installs packages which list peer dependencies, some packages will be mapped to multiple virtual directories that don't actually exist on the filesystem. This settings tells Yarn where to put them. Note that the folder name *must* be <code>$$virtual</code>.
        </>}
      />
      <SymlScalarProperty
        name={`yarnPath`}
        placeholder={`./scripts/yarn-2.0.0-rc001.js`}
        description={<>
          The path of a Yarn binary, which will be executed instead of any other (including the global one) for any command run within the directory covered by the rc file. If the file extension ends with <code>.js</code> it will be required, and will be spawned in any other case.
        </>}
      />
      <SymlScalarProperty
        name={`yarnUpgradePath`}
        placeholder={`./scripts/yarn-2.0.0-rc001.js`}
        description={<>
          If set, the <code>yarn set version</code> command will store the downloaded file at this location instead of the one referenced by <code>yarnPath</code>. This settings is useful if you want the file referenced in <code>yarnPath</code> to be a wrapper, and the real Yarn binary to be stored elsewhere.
        </>}
      />
    </SymlContainer>
  </Layout>
</>;

export default YarnrcDoc;
