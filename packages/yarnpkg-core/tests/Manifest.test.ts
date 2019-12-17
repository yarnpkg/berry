import {Manifest} from '../sources/Manifest';

describe(`Manifest`, () => {
  it(`should handle byte order mark character`, async () => {
    const manifest = Manifest.fromText('\uFEFF{"name":"foo"}');
    expect(manifest.name.name).toEqual("foo");
  });
});
