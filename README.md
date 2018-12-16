# Berry

Berry is a modern package manager split into various packages. Its novel architecture allows to do things currently impossible with existing solutions:

- Berry supports plugins; adding a plugin is as simple as adding it into your repository
- Berry supports Node by default but isn't limited to it - plugins can add support for other languages
- Berry supports [workspaces]() natively, and its CLI takes advantage of that
- Berry uses professional-grade terminal UIs built thanks to a generic React renderer, [berry-ui]()
- Berry uses a portable shell to execute package scripts, guaranteeing they work the same way on Windows and Linux
- Berry is first and foremost a Node API that can be used programmatically (through [berry-core]())
- Berry is written in TypeScript, and fully typechecked

## Generic packages

The following packages are generic and can be used in a variety of purposes (including to implement other package managers, but not only):

- [berry-core]() allows any application to manipulate a project programmatically
- [berry-json-proxy]() allows to temporarily convert any POD object to an immutable object
- [berry-libzip]() contains zlib+libzip bindings compiled to WebAssembly
- [berry-parsers]() can be used to parse [Syml]() and the language used by [berry-shell]()
- [berry-pnp]() can be used to generate [Plug'n'Play-compatible]() hooks
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
- [plugin-node★]() adds support for installing Javascript dependencies through `node_modules` directories
- [plugin-npm★]() adds support for using [semver ranges]() as dependencies, resolving them to an NPM-like registry
- [plugin-pnp★]() adds support for installing Javascript dependencies through the [Plug'n'Play]() specification

## Berry packages

The following packages are meant to be used with Berry, and won't be useful to other applications:

- [berry-builder]() contains a CLI tool to package berry and its plugins
- [berry-cli]() is a CLI built on top of [berry-core]() and some core plugins

## Build your own bundle

Clone the repository, then once inside it run the following command:

```
$> berry && berry build
```

## License (MIT)

> **Copyright © 2019 Yarn contributors**
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
