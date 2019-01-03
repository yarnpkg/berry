---
id: enhanced-scripting
title: Enhanced Scripting
sidebar_label: Enhanced Scripting
---

Script are declared by setting the `scripts` property from your `package.json`
files.

```json
{
  "scripts": {
    "build": "run babel -d -o lib/ src/",
    "test": "run jest"
  }
}
```

Berry ships with a portable shell that is expected to work across multiple
architectures. It mimics bash in a lot of aspect (while being much simpler),
which should make it drop-in in most cases. For more complex use cases, we
recommend you to instead put your logic inside an actual JavaScript file (you
can use a bash script instead, but you'll lose the portability benefit).

## Project scripts

Just like Yarn supports `yarn run <script-name>`, Berry has `berry run <script-name>`.
However, the Berry implementation is slightly more powerful and supports
*project scripts*. Project scripts are regular scripts named using a colon (`:`)
somewhere inside their name. When it happens, Berry will allow you to run these
scripts regardless from where you are inside your project (instead of scoping
its lookup to the current workspace).

```json
{
  "name": "frontend",
  "scripts": {
    "build:frontend": "run webpack"
  }
}
```

Note that a project script must be unique across a same project. If two
different workspaces have project scripts named the same way, Berry will refuse
to execute either of them.
