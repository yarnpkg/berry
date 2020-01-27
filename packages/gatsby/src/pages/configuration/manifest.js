import React                                   from 'react';

import {JsonContainer, JsonMain, JsonScalar}   from '../../components/json';
import {JsonArrayProperty, JsonObjectProperty} from '../../components/json';
import {JsonScalarProperty}                    from '../../components/json';
import {ConfigurationLayout}                   from '../../components/layout-configuration';
import {SEO, defaultKeywords}                  from '../../components/seo';

const PackageJsonDoc = () => <>
  <ConfigurationLayout>
    <SEO
      title={`Manifest fields`}
      description={`List of all the supported fields for a Yarn project manifest (package.json files)`}
      keywords={defaultKeywords}
    />
    <JsonContainer>
      <JsonMain>
        Manifest files (also called <code>package.json</code> because of their name) contain everything needed to describe the settings unique to one particular package. Project will contain multiple such manifests if they use the workspace feature, as each workspace is described through its own manifest.
      </JsonMain>
      <JsonScalarProperty
        name={`name`}
        placeholder={`@scope/name`}
        description={<>
          The name of the package. Used to identify it across the application, especially amongst multiple workspaces. The first part of the name (here <code>@scope/</code>) is optional and is used as a namespace).
        </>}
      />
      <JsonScalarProperty
        name={`version`}
        placeholder={`1.2.3`}
        description={<>
          The version of the package. Usually doesn't have any impact on your project, except when it is a workspace - then its version must match the specified ranges for the workspace to be selected as resolution candidate.
        </>}
      />
      <JsonScalarProperty
        name={`private`}
        placeholder={true}
        description={<>
          If true, the package is considered private and Yarn will refuse to publish it regardless of the circumstances. Setting this flag also unlocks some features that wouldn't make sense in published packages, such as workspaces.
        </>}
      />
      <JsonScalarProperty
        name={`license`}
        placeholder={`MIT`}
        description={<>
          An SPDX identifier that indicates under which license is your package distributed. Note that the default license can be set via the <code>initLicense</code> settings.
        </>}
      />
      <JsonScalarProperty
        name={`main`}
        placeholder={`./sources/index.js`}
        description={<>
          The path that will be used to resolve the qualified path to use when accessing the package by its name. This field can be modified at publish-time through the use of the <code>publishConfig.main</code> field.
        </>}
      />
      <JsonScalarProperty
        name={`module`}
        placeholder={`./sources/index.mjs`}
        description={<>
          The path that will be used when an ES6-compatible environment will try to access the package by its name. Doesn't have any direct effect on Yarn itself.
        </>}
      />
      <JsonScalarProperty
        name={`languageName`}
        placeholder={`node`}
        description={<>
          An enumeration used by the linker plugins to figure which linker should install a specific package. Only some values are allowed, consult the documentation to know more.
        </>}
      />
      <JsonObjectProperty
        name={`bin`}
        description={<>
          A field used to expose some executable Javascript files to the parent package. Any entry listed here will be made available through the <code>$PATH</code>. Note that it is very advised to only expose Javascript files for portability reasons (shellscripts and non-js binaries require the user to have a specific shell, and are incompatible with zip access).
        </>}
      >
        <JsonScalarProperty
          name={`my-bin`}
          placeholder={`./dist/my-bin.js`}
        />
      </JsonObjectProperty>
      <JsonObjectProperty
        name={`scripts`}
        description={<>
          A field used to list small shell scripts that will be executed when running <code>yarn run</code>. Scripts are by default executed by a miniature shell, so some advanced features might not be available (if you have more complex needs, we recommend you to just execute a Javascript file). Note that scripts containing <code>:</code> (the colon character) are globals to your project and can be called regardless of your current workspace. Finally, be aware that scripts are always executed relative to the closest workspace (never the cwd).
        </>}
      >
        <JsonScalarProperty
          name={`test`}
          placeholder={`jest`}
        />
        <JsonScalarProperty
          name={`build`}
          placeholder={`webpack-cli --config ./webpack.config.js`}
        />
        <JsonScalarProperty
          name={`count-words`}
          placeholder={`echo "$@" | wc -w`}
        />
      </JsonObjectProperty>
      <JsonObjectProperty
        name={`dependencies`}
        description={<>
          The set of dependencies that must be made available to the current package in order for it to work properly. Consult the list of supported ranges for more information.
        </>}
      >
        <JsonScalarProperty
          name={`webpack`}
          placeholder={`^5.0.0`}
        />
      </JsonObjectProperty>
      <JsonObjectProperty
        name={`optionalDependencies`}
        description={<>
          <p>Similar to the <code>dependencies</code> field, except that these entries will not be required to build properly should they have any build script. Note that such dependencies must still be resolvable and fetchable (otherwise we couldn't store it in the lockfile, which could lead to non-reproducible installs) - only the build step is optional.</p>
          <p><b>This field is usually not what you're looking for</b>, unless you depend on the <code>fsevents</code> package. If you need a package to be required only when a specific feature is used then use an optional peer dependency. Your users will have to satisfy it should they use the feature, but it won't cause the build errors to be silently swallowed when the feature is needed.</p>
        </>}
      >
        <JsonScalarProperty
          name={`fsevents`}
          placeholder={`^5.0.0`}
        />
      </JsonObjectProperty>
      <JsonObjectProperty
        name={`devDependencies`}
        description={<>
          Similar to the <code>dependencies</code> field, except that these dependencies are only installed on local installs and will never be installed by the consumers of your package. Note that because that would lead to different install trees depending on whether the install is made in "production" or "development" mode, Yarn doesn't offer a way to prevent the installation of dev dependencies at the moment.
        </>}
      >
        <JsonScalarProperty
          name={`webpack`}
          placeholder={`^5.0.0`}
        />
      </JsonObjectProperty>
      <JsonObjectProperty
        name={`peerDependencies`}
        description={<>
          Peer dependencies are inherited dependencies - the consumer of your package will be tasked to provide them. This is typically what you want when writing plugins, for example. Note that peer dependencies can also be listed as regular dependencies; in this case, Yarn will use the package provided by the ancestors if possible, but will fallback to the regular dependencies otherwise.
        </>}
      >
        <JsonScalarProperty
          name={`react`}
          placeholder={`*`}
        />
        <JsonScalarProperty
          name={`react-dom`}
          placeholder={`*`}
        />
      </JsonObjectProperty>
      <JsonArrayProperty
        name={`workspaces`}
        description={<>
          Workspaces are an optional feature used by monorepos to split a large project into semi-independent subprojects, each one listing their own set of dependencies. The <code>workspaces</code> field is a list of glob pattern that match all directories that should become workspaces of your application.
        </>}
      >
        <JsonScalar
          placeholder={`packages/*`}
        />
      </JsonArrayProperty>
      <JsonObjectProperty
        name={`dependenciesMeta`}
        description={<>
          This field lists some extra information related to the dependencies listed in the <code>dependencies</code> and <code>devDependencies</code> field. In the context of a workspaced project most of these settings will affect <em>all workspaces</em> and as such must be specified at the <em>root</em> of the project (except if noted otherwise, the <code>dependenciesMeta</code> field will be ignored if found within a workspace).
        </>}
      >
        <JsonObjectProperty
          name={`fsevents`}
          margin={true}
        >
          <JsonScalarProperty
            name={`built`}
            anchor={`dependenciesMeta.built`}
            placeholder={false}
            description={<>
              If false, the package will never be built. When the global settings <code>enableScripts</code> is toggled off, setting this additional flag will also downgrade the warning into a simple notice for this specific package.
            </>}
          />
          <JsonScalarProperty
            name={`optional`}
            anchor={`dependenciesMeta.optional`}
            placeholder={false}
            description={<>
              <p>If true, the build isn't required to succeed for the install to be considered a success. It's what the <code>optionalDependencies</code> field compiles down to.</p>
              <p><b>This settings will be applied even when found within a nested manifest</b>, but the highest requirement in the dependency tree will prevale.</p>
            </>}
          />
          <JsonScalarProperty
            name={`unplugged`}
            anchor={`dependenciesMeta.unplugged`}
            placeholder={true}
            description={<>
              If true, the specified package will be automatically unplugged at install time. This should only be needed for packages that contain scripts in other languages than Javascript (for example <code>nan</code> contains C++ headers).
            </>}
          />
        </JsonObjectProperty>
      </JsonObjectProperty>
      <JsonObjectProperty
        name={`peerDependenciesMeta`}
        description={<>
          This field lists some extra information related to the dependencies listed in the <code>peerDependencies</code> field.
        </>}
      >
        <JsonObjectProperty
          name={`react-dom`}
          margin={true}
        >
          <JsonScalarProperty
            name={`optional`}
            anchor={`peerDependenciesMeta.optional`}
            placeholder={true}
            description={<>
              If true, the selected peer dependency will be marked as optional by the package manager and the consumer omitting it won't be reported as an error.
            </>}
          />
        </JsonObjectProperty>
      </JsonObjectProperty>
      <JsonObjectProperty
        name={`resolutions`}
        description={<>
          This field allows you to instruct Yarn to use a specific resolution instead of anything the resolver would normally pick. This is useful to enforce all your packages to use a single version of a dependency, or backport a fix. The syntax for the resolution key accepts one level of specificity, so all the following examples are correct.
        </>}
      >
        <JsonScalarProperty
          name={`relay-compiler`}
          placeholder={`3.0.0`}
        />
        <JsonScalarProperty
          name={`webpack/memory-fs`}
          placeholder={`0.4.1`}
        />
        <JsonScalarProperty
          name={`@babel/core/json5`}
          placeholder={`2.1.0`}
        />
        <JsonScalarProperty
          name={`@babel/core/@babel/generator`}
          placeholder={`7.3.4`}
        />
        <JsonScalarProperty
          name={`@babel/core@npm:7.0.0/@babel/generator`}
          placeholder={`7.3.4`}
        />
      </JsonObjectProperty>
      <JsonObjectProperty
        name={`publishConfig`}
        margin={true}
        description={<>
          This field contains various settings that are only taken into consideration when a package is generated from your local sources (either through <code>yarn pack</code> or one of the publish commands like <code>yarn npm publish</code>).
        </>}
      >
        <JsonScalarProperty
          name={`access`}
          anchor={`publishConfig.access`}
          placeholder={`public`}
          description={<>
            Defines the package access level to use when publishing packages to the npm registry. Valid values are <code>public</code> and <code>restricted</code>, but <code>restricted</code> usually requires to register for a paid plan (this is up to the registry you use).
          </>}
        />
        <JsonScalarProperty
          name={`bin`}
          anchor={`publishConfig.bin`}
          placeholder={`./build/bin.js`}
          description={<>
            If present, the top-level <code>bin</code> field from the manifest will be set to this new value before the package is packed to be shipped to remote registries. This won't modify the real manifest, just the one stored within the tarball.
          </>}
        />
        <JsonScalarProperty
          name={`browser`}
          anchor={`publishConfig.browser`}
          placeholder={`./build/browser.js`}
          description={<>
            Same principle as the <code>publishConfig.bin</code> property; this value will be used instead of the top-level <code>browser</code> field when generating the workspace tarball.
          </>}
        />
        <JsonScalarProperty
          name={`main`}
          anchor={`publishConfig.main`}
          placeholder={`./build/index.js`}
          description={<>
            Same principle as the <code>publishConfig.bin</code> property; this value will be used instead of the top-level <code>main</code> field when generating the workspace tarball.
          </>}
        />
        <JsonScalarProperty
          name={`module`}
          anchor={`publishConfig.module`}
          placeholder={`./build/index.mjs`}
          description={<>
            Same principle as the <code>publishConfig.bin</code> property; this value will be used instead of the top-level <code>module</code> field when generating the workspace tarball.
          </>}
        />
        <JsonScalarProperty
          name={`registry`}
          anchor={`publishConfig.registry`}
          placeholder={`https://npm.pkg.github.com`}
          description={<>
            If present, will replace whatever registry is defined in the configuration when the package is about to be pushed to a remote location.
          </>}
        />
      </JsonObjectProperty>
    </JsonContainer>
  </ConfigurationLayout>
</>;

// eslint-disable-next-line arca/no-default-export
export default PackageJsonDoc;
