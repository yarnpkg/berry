---
sidebar_position: 1
---

# Tutorial Intro

```ts twoslash title="packages/yarnpkg-website/sources/foo.ts"
import {
  suggestUtils,
} from '@yarnpkg/plugin-essentials';
```

```twoslash include main
// @moduleResolution: node

import {
  Cache,
  Configuration,
  Descriptor,
  InstallOptions,
  Locator,
  MessageName,
  PackageExtensionData,
  Project,
  Resolver,
  ResolveOptions,
  Workspace,
  formatUtils,
  structUtils,
} from '@yarnpkg/core';

import {
  PortablePath,
} from '@yarnpkg/fslib';

import {
  suggestUtils,
} from '@yarnpkg/plugin-essentials';

import {
  Writable,
  Readable,
}from 'stream';
```

import from "@yarnpkg/monorepo/scripts/extract-hooks";

foobar
Let's discover **Docusaurus in less than 5 minutes**.

```json
{ "json": true }
```

```ts twoslash
// @include: main

import {CommandContext} from '@yarnpkg/core';
import {CommandContext} from '@yarnpkg/core';

declare const context: CommandContext;

// ---cut---

import {Cache, Configuration, Project} from '@yarnpkg/core';

const configuration = await Configuration.find(context.cwd, context.plugins);
const {project, workspace} = await Project.find(configuration, context.cwd);
const cache = await Cache.find(configuration);

await project.restoreInstallState({
  restoreResolutions: false,
});
```

```ts twoslash
interface IdLabel {id: number, /* some fields */ }
interface NameLabel {name: string, /* other fields */ }
type NameOrId<T extends number | string> = T extends number ? IdLabel : NameLabel;
// This comment should not be included

// ---cut---
function createLabel<T extends number | string>(idOrName: T): NameOrId<T> {
  throw "unimplemented"
}

let a = createLabel("typescript");
```

## Getting Started

Get started by **creating a new site**.

Or **try Docusaurus immediately** with **[new.docusaurus.io](https://new.docusaurus.io)**.

## Generate a new site

Generate a new Docusaurus site using the **classic template**:

```shell
npx @docusaurus/init@latest init my-website classic
```

## Start your site

Run the development server:

```shell
cd my-website

npx docusaurus start
```

Your site starts at `http://localhost:3000`.

Open `docs/intro.md` and edit some lines: the site **reloads automatically** and display your changes.
