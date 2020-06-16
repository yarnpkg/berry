# `@yarnpkg/shell`

A JavaScript implementation of a bash-like shell (we use it in Yarn 2 to provide cross-platform scripting). This package exposes an API that abstracts both the parser and the interpreter; should you only need the parser you can check out `@yarnpkg/parsers`, but you probably won't need it.

## Usage

```ts
import {execute} from '@yarnpkg/shell';

process.exitCode = await execute(`ls "$1" | wc -l`, [process.cwd()]);
```

## Features

- Typechecked
- Portable across systems
- Supports custom JS builtins
- Supports pipes
- Supports glob patterns (**only** for files that exist on the filesystem: `ls *.txt`)
- Supports logical operators
- Supports subshells
- Supports variables
- Supports string manipulators
- Supports argc/argv
- Supports the most classic builtins
- Doesn't necessarily need to access the fs

## Help Wanted

- Full glob support (`mv build/{index.js,index.build.js}`, `echo {foo,bar}`, `FOO=a,b echo {$FOO,x}`)
- More string manipulators

## Non-Goals

- Perfect POSIX compliance (basic scripting is enough for now)
- Multiline scripts (we mostly target one-liners)
- Control structures (same reason)
