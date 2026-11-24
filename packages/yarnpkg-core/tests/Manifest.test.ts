import {Package, nodeUtils, structUtils} from '@yarnpkg/core';

import {Manifest}                        from '../sources/Manifest';

const isCompatible = (manifest: string, {os = null, cpu = null, libc = null}: Partial<nodeUtils.ArchitectureSet>) => {
  const conditions = Manifest.fromText(manifest).getConditions();

  return structUtils.isPackageCompatible({conditions} as Package, {os, cpu, libc});
};

describe(`Manifest`, () => {
  it(`should handle byte order mark character`, async () => {
    const manifest = Manifest.fromText(`\uFEFF{"name":"foo"}`);
    expect(manifest.name!.name).toEqual(`foo`);
  });

  it(`should handle 'workspaces' set to null`, () => {
    expect(() => Manifest.fromText(`{"workspaces":null}`)).not.toThrow();
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

    it(`should preserve bin if a string was specified`, () => {
      const manifest = Manifest.fromText(`{ "name": "name", "bin": "./bin.js" }`);
      expect(manifest.exportTo({}).bin).toEqual(`./bin.js`);
    });

    it(`should preserve bin map if a hash was specified`, () => {
      const manifest = Manifest.fromText(`{ "name": "name", "bin": { "bin1": "./bin1.js", "bin2": "./bin2.js" } }`);
      expect(manifest.exportTo({}).bin).toEqual({bin1: `./bin1.js`, bin2: `./bin2.js`});
    });

    it(`should remove bin if an empty path was specified`, () => {
      const manifest = Manifest.fromText(`{ "name": "name", "bin": "" }`);
      expect(manifest.exportTo({}).bin).toEqual(undefined);
    });

    it(`should remove entries from bin map if an empty path was specified`, () => {
      const manifest = Manifest.fromText(`{ "name": "name", "bin": { "bin1": " ", "bin2": "./bin2.js" } }`);
      expect(manifest.exportTo({}).bin).toEqual({bin2: `./bin2.js`});
    });
  });

  describe(`publishConfig`, () => {
    it(`should parse provenance field when set to true`, () => {
      const manifest = Manifest.fromText(`{ "publishConfig": { "provenance": true } }`);
      expect(manifest.publishConfig?.provenance).toBe(true);
    });

    it(`should parse provenance field when set to false`, () => {
      const manifest = Manifest.fromText(`{ "publishConfig": { "provenance": false } }`);
      expect(manifest.publishConfig?.provenance).toBe(false);
    });

    it(`should ignore non-boolean provenance values`, () => {
      const manifest = Manifest.fromText(`{ "publishConfig": { "provenance": "true" } }`);
      expect(manifest.publishConfig?.provenance).toBeUndefined();
    });
  });

  describe(`getConditions`, () => {
    it(`should keep single values as-is`, () => {
      expect(Manifest.fromText(`{"os": ["linux"]}`).getConditions()).toEqual(`os=linux`);
      expect(Manifest.fromText(`{"os": ["!win32"]}`).getConditions()).toEqual(`!os=win32`);
    });

    it(`should match any of the listed values`, () => {
      const manifest = `{"cpu": ["x64", "arm64"]}`;

      expect(Manifest.fromText(manifest).getConditions()).toEqual(`(cpu=x64 | cpu=arm64)`);
      expect(isCompatible(manifest, {cpu: [`x64`]})).toEqual(true);
      expect(isCompatible(manifest, {cpu: [`arm64`]})).toEqual(true);
      expect(isCompatible(manifest, {cpu: [`ia32`]})).toEqual(false);
    });

    it(`should match none of the negated values`, () => {
      const manifest = `{"cpu": ["!arm", "!arm64", "!riscv64", "!x64"]}`;

      expect(Manifest.fromText(manifest).getConditions()).toEqual(`(!cpu=arm & !cpu=arm64 & !cpu=riscv64 & !cpu=x64)`);
      expect(isCompatible(manifest, {cpu: [`x64`]})).toEqual(false);
      expect(isCompatible(manifest, {cpu: [`arm64`]})).toEqual(false);
      expect(isCompatible(manifest, {cpu: [`ppc64`]})).toEqual(true);
    });

    it(`should combine listed and negated values`, () => {
      const manifest = `{"os": ["linux", "darwin", "!darwin"]}`;

      expect(Manifest.fromText(manifest).getConditions()).toEqual(`((os=linux | os=darwin) & !os=darwin)`);
      expect(isCompatible(manifest, {os: [`linux`]})).toEqual(true);
      expect(isCompatible(manifest, {os: [`darwin`]})).toEqual(false);
      expect(isCompatible(manifest, {os: [`win32`]})).toEqual(false);
    });

    it(`should combine negated values across fields`, () => {
      const manifest = `{"os": ["!android", "!darwin", "!linux", "!win32"], "cpu": ["!x64"]}`;

      expect(isCompatible(manifest, {os: [`freebsd`], cpu: [`arm64`]})).toEqual(true);
      expect(isCompatible(manifest, {os: [`freebsd`], cpu: [`x64`]})).toEqual(false);
      expect(isCompatible(manifest, {os: [`darwin`], cpu: [`arm64`]})).toEqual(false);
    });

    it(`should accept a set if any of its values is accepted`, () => {
      const manifest = `{"os": ["!win32"]}`;

      expect(isCompatible(manifest, {os: [`darwin`, `linux`, `win32`]})).toEqual(true);
      expect(isCompatible(manifest, {os: [`win32`]})).toEqual(false);
    });

    it(`should check each system of a set on its own`, () => {
      const manifest = `{"os": ["darwin"], "cpu": ["!x64"]}`;

      expect(isCompatible(manifest, {os: [`darwin`, `linux`], cpu: [`x64`, `arm64`]})).toEqual(true);
      expect(isCompatible(manifest, {os: [`linux`], cpu: [`x64`, `arm64`]})).toEqual(false);
    });

    it(`should accept a negated libc when no libc is supported`, () => {
      expect(isCompatible(`{"libc": ["!musl"]}`, {libc: []})).toEqual(true);
      expect(isCompatible(`{"libc": ["glibc"]}`, {libc: []})).toEqual(false);
    });
  });
});
