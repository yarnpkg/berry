# ZipFS

This extension adds support into VSCode to read files directly from zip archives. It's maintained as part of the Yarn toolchain. Using this extension together with the [Yarn SDK](https://yarnpkg.com/advanced/editor-sdks) will allow you to seamlessly open & edit files from your cache.

## New protocol: `zip:`

Paths starting with the `zip:` protocol (e.g. `zip:/foo/bar.zip/index.js`) will be resolved, the zip archive being extracted and opened as if it was a folder.
