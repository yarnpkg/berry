# Berry

Berry is a modern package manager split into various packages. Its novel architecture allows to do things currently impossible with existing solutions:

- Berry supports plugins; adding a plugin is as simple as adding it into your repository
- Berry supports Node by default, but isn't limited to it - plugins can add support for other languages
- Berry supports [workspaces]() natively, and its CLI takes advantage of that
- Berry uses professional-grade terminal UIs built thanks to a generic React renderer, [berry-ui]()
- Berry uses a portable mini-shell to execute user commands, guaranteeing they work the same way on Windows and Linux
- Berry is first and foremost a Node API that can be used programmatically (through [berry-core]())
- Berry is written in TypeScript, and fully typechecked

## First-class citizen support for Plug'n'Play+zip

Because Berry is compatible with Plug'n'Play by default, Node installations are typically instantaneous with a warm cache. And because it also supports zip installations by default, the Plug'n'Play loaders it generates can read files from the mirror tarball without needing to unpack them. Accessing the archives is done through [berry-libzip]() which contains libzip bindings compiled to WebAssembly, providing unparalleled speed at runtime compared to JS-only implementations. And because WebAssembly is portable, the loader can safely be used accross all architectures.

## Generic packages

The following packages are generic and can be used in a variety of purposes:

- [berry-core]() allows any application to manipulate a project programmatically
- [berry-json-proxy]() allows to temporarily convert any POD object to an immutable object
- [berry-libzip]() contains zlib+libzip bindings compiled to WebAssembly
- [berry-parsers]() can be used to parse [Syml]() and the language used by [berry-shell]()
- [berry-shell]() is a portable bash-like shell interpreter
- [berry-ui]() is a React renderer targeting terminals
- [berry-zipfs]() is a `fs` implementation that can read files from zip archives

## Berry plugins

The following packages are plugins for Berry and can be installed through `berry add plugin <plugin-name>`. Note that some of them are typically already shipped with the regular Berry bundles. Such plugins are marked with a star:

- [plugin-constraints]() adds various commands for enforcing constraints across workspaces.
- [plugin-file★]() adds support for using `file:` references as dependencies.
- [plugin-github★]() adds support for using Github references as dependencies. [This plugin doesn't use git.](https://stackoverflow.com/a/13636954/880703)
- [plugin-http★]() adds support for using straight URL references as dependencies (tgz archives only).
- [plugin-hub]() contains a UI designed to efficiently manage large-scale projects with multiple workspaces
- [plugin-link★]() adds support for using `link:` and `portal:` references as dependencies.
- [plugin-npm★]() adds support for using [semver ranges]() as dependencies, resolving them to an NPM-like registry

## Berry packages

The following packages are meant to be used with Berry, and won't be useful to other applications:

- [berry-builder]() contains a CLI tool to package berry and its plugins
- [berry-cli]() is a CLI built on top of [berry-core]() and some core plugins
