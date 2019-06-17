# `@berry/shell`

A Javascript implementation of a bash-like shell (we use it in Yarn 2 to provide cross-platform scripting). This package contains the parser and interpreter merged together; for the parser only you can check the `@berry/parsers` package, but you probably won't need it.

## Usage

```ts
import {execute} from '@berry/shell';

process.exitCode = await execute(`ls "$1" | wc -l`, [process.cwd()]);
```

## Features

- Typechecked
- Portable across systems
- Supports custom JS builtins
- Supports pipes
- Supports logical operators
- Supports subshells
- Supports variables
- Supports string manipulators
- Supports argc/argv
- Supports the most class builtins
- Doesn't necessarily need to access the fs

## Help Wanted

- Stream redirections (`> foo`)
