---
id: enhanced-scripting
title: Enhanced Scripting
sidebar_label: Enhanced Scripting
---

Regular scripts are declared by setting the `scripts` property from your
`package.json` files. Any such script will be made accessible through the
`yarn run <script-name>` and `yarn <script-name>` commands (the former syntax
is what we advise to use within your deployment scripts, while the later one
often provides the best developer experience for your daily work).

```json
{
  "scripts": {
    "build": "babel -d -o lib/ src/",
    "test": "jest"
  }
}
```

## Portable scripts

Starting from Berry, Yarn ships with a portable shell that is expected to work
across multiple architectures. It mimics Bash a lot (while being much simpler),
which should make it drop-in in most cases. For more complex use cases, we
recommend you to instead put your logic inside an actual JavaScript file (you
can use a bash script instead, but you'll lose the portability benefit).

## Script arguments

Starting from Berry, scripts can now access their arguments using the special
variables `$#` and `$@` (and `$1`, etc). It works exactly the same way as in
Bash, meaning that `"$@"` will cause all the arguments to be inserted at the
specified location in the command-line.

```json
{
  "scripts": {
    "grep": "grep -R \"$1\" sources"
  }
}
```

Note that if the script arguments are used anywhere in a script, the default
behavior of appending the arguments at the end of this script when executed
will not occur. This shouldn't be a problem because the `$@` variable can be
used as many times as you wish, meaning that you can explicitly choose to
restore this behavior:

```json
{
  "scripts": {
    "lint-n-test": "run lint \"$@\" && run test \"$@\""
  }
}
```

## Project scripts

Starting from Berry, Yarn's implementation of `yarn run` is slightly more
powerful than it originally was. It now supports what we call *project scripts*.
Project scripts are regular scripts named using a colon (`:`) somewhere inside
their name. When such a script is run, Berry will allow you to run these
scripts regardless from where you are inside your project (instead of scoping
the script lookup to the current workspace as it would normally do).

A typical usage would be to allow building your application tests regardless of
where you are in the current repository: 

```json
{
  "private": true,
  "scripts": {
    "run:tests": "jest"
  }
}
```

Note that the name used for a project script must be unique across a same
project. If two different workspaces list project scripts sharing the same
name, Berry will refuse to execute either of them unless you run them from
their respective directories.
