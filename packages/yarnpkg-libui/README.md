# `@yarnpkg/libui`

This library is used to power parts of the UI in our interactive plugins.

## Components

### `Application`

A component that setups the state.

### `<ScrollableItems size={number} children={ReactEle}/>`

A scrollable container which will display at most `2 * size + 1` lines of result on screen and will watch the up and down keys to scroll.

**Note:** The current implementation only supports children with an explicit `key` parameter and a height of exactly 1 row.

## Hooks

### `useListItems`

A key listener that watches for two keys (configurable through `minus` and `plus`) and triggers the `set` callback when either of them is pressed.
