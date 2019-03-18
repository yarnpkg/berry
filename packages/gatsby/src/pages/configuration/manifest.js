import React                                    from 'react';

import {JsonContainer, JsonString}              from '../../components/json';
import {JsonArrayProperty, JsonBooleanProperty} from '../../components/json';
import {JsonObjectProperty, JsonStringProperty} from '../../components/json';
import Layout                                   from '../../components/layout-configuration';

const PackageJsonDoc = () => <>
  <Layout>
    <JsonContainer>
      <JsonStringProperty
        name={`name`}
        placeholder={`@scope/name`}
        description={<>
          The name of the package. Used to identify it accross the application, especially amongst multiple workspaces. The first part of the name (here <code>@scope/</code>) is optional and is used as a namespace).
        </>}
      />
      <JsonStringProperty
        name={`version`}
        placeholder={`1.2.3`}
        description={<>
          The version of the package. Usually doesn't have any impact on your project, except when it is a workspace - then its version must match the specified ranges for the workspace to be selected as resolution candidate.
        </>}
      />
      <JsonBooleanProperty
        name={`private`}
        placeholder={`true`}
        description={<>
          If true, the package is considered private and Yarn will refuse to publish it regardless of the circumstances. Setting this flag also unlocks some features that wouldn't make sense in published packages, such as workspaces.
        </>}
      />
      <JsonStringProperty
        name={`license`}
        placeholder={`MIT`}
        description={<>
          An SPDX identifier that indicates under which license is your package distributed. Note that the default license can be set via the <code>initLicense</code> settings.
        </>}
      />
      <JsonStringProperty
        name={`languageName`}
        placeholder={`node`}
        description={<>
          An enumeration used by the linker plugins to figure which linker should install a specific package. Only some values are allowed, consult the documentation to know more.
        </>}
      />
      <JsonObjectProperty
        name={`bin`}
        description={<>
          A field used to expose some executable Javascript files to the parent package. Any entry listed here will be made available through the <code>$PATH</code>. Note that it is very advised to only expose Javascript files for portability reasons (shell scripts require the user to have a specific shell, and are incompatibles with zip access).
        </>}
      >
        <JsonStringProperty
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
        <JsonStringProperty
          name={`test`}
          placeholder={`jest`}
        />
        <JsonStringProperty
          name={`build`}
          placeholder={`webpack-cli --config ./webpack.config.js`}
        />
        <JsonStringProperty
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
        <JsonStringProperty
          name={`webpack`}
          placeholder={`^5.0.0`}
        />
      </JsonObjectProperty>
      <JsonObjectProperty
        name={`devDependencies`}
        description={<>
          Similar to the <code>dependencies</code> field, except that these dependencies are only installed on local installs and will never be installed by the consumers of your package. Note that because that would lead to different install trees depending on whether the install is made in "production" or "development" mode, Yarn doesn't offer a way to prevent the installation of dev dependencies at the moment.
        </>}
      >
        <JsonStringProperty
          name={`webpack`}
          placeholder={`^5.0.0`}
        />
      </JsonObjectProperty>
      <JsonObjectProperty
        name={`peerDependencies`}
        description={<>
          Peer dependencies are inherited dependencies - the consumer of your package will be tasked to provide them. This is typically what you want when writting plugins, for example. Be careful: listing peer dependencies will have side effects on the way your package will be executed by your consumers. Check the documentation for more information.
        </>}
      >
        <JsonStringProperty
          name={`react`}
          placeholder={`*`}
        />
        <JsonStringProperty
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
        <JsonString
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
          <JsonBooleanProperty
            name={`built`}
            placeholder={`false`}
            description={<>
              If false, the package will never be built. When the global settings <code>enableScripts</code> is toggled off, setting this additional flag will also downgrade the warning into a simple notice for this specific package.
            </>}
          />
          <JsonBooleanProperty
            name={`unplugged`}
            placeholder={`true`}
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
          <JsonBooleanProperty
            name={`optional`}
            placeholder={`true`}
            description={<>
              If true, the selected peer dependency will be marked as optional by the package manager and the consumer omitting it won't be reported as an error.
            </>}
          />
        </JsonObjectProperty>
      </JsonObjectProperty>
      <JsonObjectProperty
        name={`dependenciesMeta`}
        description={<>
          This field allows you to instruct Yarn to use a specific resolution instead of anything the resolver would normally pick. This is useful to enforce all your packages to use a single version of a dependency, or backport a fix. The syntax for the resolution key accepts one level of specificity, so all the following examples are correct.
        </>}
      >
        <JsonStringProperty
          name={`relay-compiler`}
          placeholder={`3.0.0`}
        />
        <JsonStringProperty
          name={`webpack/memory-fs`}
          placeholder={`0.4.1`}
        />
        <JsonStringProperty
          name={`@babel/core/json5`}
          placeholder={`2.1.0`}
        />
        <JsonStringProperty
          name={`@babel/core/@babel/generator`}
          placeholder={`7.3.4`}
        />
        <JsonStringProperty
          name={`@babel/core@npm:7.0.0/@babel/generator`}
          placeholder={`7.3.4`}
        />
        <JsonStringProperty
          name={`@babel/core/@npm:babel/generator@npm:^7.0.0`}
          placeholder={`7.3.4`}
        />
      </JsonObjectProperty>
    </JsonContainer>
  </Layout>
</>;

export default PackageJsonDoc;
