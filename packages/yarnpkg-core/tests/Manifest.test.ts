import {Manifest} from '../sources/Manifest';

describe(`Manifest`, () => {
  it(`should handle byte order mark character`, async () => {
    const manifest = Manifest.fromText(`\uFEFF{"name":"foo"}`);
    expect(manifest.name!.name).toEqual(`foo`);
  });

  describe(`exportTo`, () => {
    it(`should add a scripts field if a script was newly added`, () => {
      const manifest = Manifest.fromText(`{}`);
      manifest.scripts.set(`foo`, `bar`);
      expect(manifest.exportTo({}).scripts).toEqual({foo: `bar`});
    });

    it(`should remove the scripts field if the last script was deleted`, () => {
      const manifest = Manifest.fromText(`{ "scripts": { "foo": "bar" } }`);
      manifest.scripts.delete(`foo`);
      expect(manifest.exportTo({}).scripts).toBeUndefined();
    });

    it(`should respect changes to scripts, preserving existing order`, () => {
      const manifest = Manifest.fromText(`{ "scripts": { "zzz-first": "first", "aaa-last": "last" } }`);
      manifest.scripts.set(`zzz-first`, `changed first`);
      manifest.scripts.delete(`aaa-last`);
      manifest.scripts.set(`start`, `node index.js`);

      expect(Object.entries(manifest.exportTo({}).scripts)).toEqual([
        [`zzz-first`, `changed first`],
        [`start`, `node index.js`],
      ]);
    });
  });
});
