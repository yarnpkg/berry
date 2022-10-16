import {stringifySyml} from '@yarnpkg/parsers';


describe(`Syml stringifier`, () => {
  it(`stringifies an object`, () => {
    expect(stringifySyml({foo: {bar: `true`, baz: `quux`}})).toEqual(`foo:\n  bar: true\n  baz: quux\n`);
  });

  it(`stringifies an object with a long key with yaml 1.2 spec`, () => {
    const longKey = `a`.repeat(1025); // long key is a string of length > 1024
    expect(stringifySyml({[longKey]: {bar: `true`, baz: `quux`}})).toEqual(`? ${longKey}\n:\n  bar: true\n  baz: quux\n`);
    expect(stringifySyml({[longKey]: {[longKey]: `quux`, baz: `quux`}})).toEqual(`? ${longKey}\n:\n  ? ${longKey}\n  : quux\n  baz: quux\n`);
    expect(stringifySyml({[longKey]: {[longKey]: {aa: `quux`, [longKey]: `zip`}, baz: `zax`}})).toEqual(`? ${longKey}\n:\n  ? ${longKey}\n  :\n    aa: quux\n    ? ${longKey}\n    : zip\n  baz: zax\n`);
  });
});
