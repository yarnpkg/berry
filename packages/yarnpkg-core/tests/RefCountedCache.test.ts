import {RefCountedCache} from '../sources/RefCountedCache';

describe(`RefCountedCache`, () => {
  it(`should create value on first create`, () => {
    const actions: Array<string> = [];
    const cache = new RefCountedCache<string, string>((id => actions.push(`release ${id}`)));

    const result = cache.addOrCreate(`a`, () => {
      const result = `create a-1`; actions.push(result); return result;
    });

    expect(result.value).toBe(`create a-1`);
    expect(actions).toStrictEqual([`create a-1`]);
  });

  it(`should release single value`, () => {
    const actions: Array<string> = [];
    const cache = new RefCountedCache<string, string>((id => actions.push(`release ${id}`)));

    const result = cache.addOrCreate(`a`, () => {
      const result = `create a-1`; actions.push(result); return result;
    });

    result.release();
    expect(actions).toStrictEqual([`create a-1`, `release create a-1`]);
  });

  it(`should return first created value and only release on the last value`, () => {
    const actions: Array<string> = [];
    const cache = new RefCountedCache<string, string>((id => actions.push(`release ${id}`)));

    const result1 = cache.addOrCreate(`a`, () => {
      const result = `create a-1`; actions.push(result); return result;
    });

    expect(result1.value).toBe(`create a-1`);
    expect(actions).toStrictEqual([`create a-1`]);

    // Creating new value with same key should reuse the previous value.
    const result2 = cache.addOrCreate(`a`, () => {
      const result = `create a-2`; actions.push(result); return result;
    });

    expect(result2.value).toBe(`create a-1`);
    expect(actions).toStrictEqual([`create a-1`]);

    // releasing one should not call release function
    result1.release();
    expect(actions).toStrictEqual([`create a-1`]);

    // releasing second should call release, but on the first created instance.
    result2.release();
    expect(actions).toStrictEqual([`create a-1`, `release create a-1`]);
  });

  it(`should handle multiple keys single value`, () => {
    const actions: Array<string> = [];
    const cache = new RefCountedCache<string, string>((id => actions.push(`release ${id}`)));

    const result1 = cache.addOrCreate(`a`, () => {
      const result = `create a-1`; actions.push(result); return result;
    });

    result1.release();

    const result2 = cache.addOrCreate(`b`, () => {
      const result = `create b-2`; actions.push(result); return result;
    });

    result2.release();

    const result3 = cache.addOrCreate(`c`, () => {
      const result = `create c-3`; actions.push(result); return result;
    });

    cache.addOrCreate(`d`, () => {
      const result = `create d-4`; actions.push(result); return result;
    });

    const result5 = cache.addOrCreate(`e`, () => {
      const result = `create e-5`; actions.push(result); return result;
    });

    result5.release();
    // skipping release 4 release
    result3.release();

    expect(actions).toStrictEqual([
      `create a-1`,
      `release create a-1`,
      `create b-2`,
      `release create b-2`,
      `create c-3`,
      `create d-4`,
      `create e-5`,
      `release create e-5`,
      `release create c-3`,
    ]);
  });

  it(`should can create new instances after removing releasing value`, () => {
    const actions: Array<string> = [];
    const cache = new RefCountedCache<string, string>((id => actions.push(`release ${id}`)));

    const result1 = cache.addOrCreate(`a`, () => {
      const result = `create a-1`; actions.push(result); return result;
    });

    const result2 = cache.addOrCreate(`a`, () => {
      const result = `create a-2`; actions.push(result); return result;
    });

    result1.release();
    result2.release();

    const result3 = cache.addOrCreate(`a`, () => {
      const result = `create a-3`; actions.push(result); return result;
    });

    const result4 = cache.addOrCreate(`a`, () => {
      const result = `create a-4`; actions.push(result); return result;
    });

    result4.release();
    result3.release();

    expect(actions).toStrictEqual([
      `create a-1`,
      `release create a-1`,
      `create a-3`,
      `release create a-3`,
    ]);
  });

  it(`should throw when releasing too many times`, () => {
    const actions: Array<string> = [];
    const cache = new RefCountedCache<string, string>((id => actions.push(`release ${id}`)));

    const result1 = cache.addOrCreate(`a`, () => {
      const result = `create a-1`; actions.push(result); return result;
    });

    result1.release();

    expect(() => {
      result1.release();
    }).toThrow(/No known instances of: "a"/);
  });
});
