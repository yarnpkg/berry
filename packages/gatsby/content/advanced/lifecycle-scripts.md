---
category: advanced
path: /advanced/lifecycle-scripts
title: "Lifecycle Scripts"
---

Packages can define in the `scripts` field of their manifest various actions that should be executed when the package manager executes a particular workflow. Here they are:

> **Note about `yarn pack`:** Although rarely called directly, `yarn pack` is a crucial part of Yarn. Each time Yarn has to fetch a dependency from a "raw" source (such as a Git repository), it will automatically run `yarn install` and `yarn pack` on it to know which are the files to use.

- **prepack** is the lifecycle script called before each call to `yarn pack`. This is typically the place where you'll want to put scripts that build a package - such as transpiling its source.

- **postpack** is called right after `yarn pack`, whether the call succeeded or not. This is typically the place where you'll clean your working directory from the build artifacts (note that whether to actually clean them or not is purely optional).

- **prepublish** is called before `yarn npm publish` and similar commands (even before the package has been packed). This is the place where you'll want to check that the project is in an ok state. Because it's only called on prepublish, **the prepublish hook shouldn't have side effects.** In particular don't transpile the package sources in prepublish, as people consuming directly your repository wouldn't be able to use your project.

- **postinstall** is called after a package got successfully installed on the disk. It is guaranteed.

Note that we don't support every single lifecycle script originally present in npm. This is a deliberate decision based on the observation that too many lifecycle scripts make it difficult to know which one to use in which circumstances, leading to confusion and mistakes. We are open to add the missing ones on a case-by-case basis if compelling use cases are provided.

> In particular, we intentionally don't support arbitrary `pre` and `post` hooks for user-defined scripts (such as `prestart`). This behavior, inherited from npm, caused scripts to be implicit rather than explicit, obfuscating the execution flow. It also led to surprising executions with `yarn serve` also running `yarn preserve`.

## A note about `postinstall`

Postinstall scripts have very real consequences for your users. In most cases Yarn will keep the installed packages in its cache under their archive form, and will instruct Node to load the files directly from there. This leads to much smaller installs, and eventually to [Zero-Installs](/features/zero-installs).

Unfortunately postinstall scripts break this model because they signal Yarn that those packages may need to mutate their own directory, forcing them to be extracted into physical locations on the disk and leading to heavier, slower, and less stable installs.

Depending on your use case, here's how you can avoid postinstall scripts:

- Native packages can be built to [WebAssembly](https://webassembly.org), which is already supported in Node 12 and beyond. On top of being portable and fast, WebAssembly packages also have the benefit to make your libraries available not only to Node but also to your browser users. And since their compilation is made upfront, your users won't be impacted by slow compilation time problems.

- Project sustainability is a big topic, but the gist is that we don't think postinstall scripts are a viable solution. We however are committed to providing a specific field in the package.json that would signal to the package managers that a project would like to communicate its existence with the user in an integrated and respectful way.
