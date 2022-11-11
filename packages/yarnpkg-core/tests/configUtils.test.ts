import * as configUtils from '../sources/configUtils';

const s = configUtils.RESOLVED_RC_FILE;

describe(`configurationUtils`, () => {
  describe(`resolveRcFiles`, () => {
    it(`it should resolve all RcFile according to the \`onConflict\` option`, () => {
      expect(
        configUtils.resolveRcFiles([
          [`a`, [`foo`]],
          [`b`, [`bar`]],
          [`c`, [`baz`]],
        ]),
      ).toEqual(
        [`a, b, c`, [
          [`a`, `foo`, s],
          [`b`, `bar`, s],
          [`c`, `baz`, s],
        ], s],
      );

      expect(
        configUtils.resolveRcFiles([
          [`a`, [`foo`]],
          [`b`, {onConflict: `reset`, value: [`bar`]}],
          [`c`, [`baz`]],
        ]),
      ).toEqual(
        [`b, c`, [
          [`b`, `bar`, s],
          [`c`, `baz`, s],
        ], s],
      );

      expect(
        configUtils.resolveRcFiles([[`a`, [{foo: `bar`}]]]),
      ).toEqual(
        [`a`, [
          [`a`, {foo: [`a`, `bar`, s]}, s],
        ], s],
      );

      expect(
        configUtils.resolveRcFiles([
          [`a`, [`foo`]],
          [`b`, 42],
        ]),
      ).toEqual(
        [`b`, 42, s],
      );

      expect(
        configUtils.resolveRcFiles([
          [`a`, {foo: `foo`}],
          [`b`, {bar: `bar`}],
          [`c`, {baz: `baz`}],
        ]),
      ).toEqual(
        [`a, b, c`, {
          foo: [`a`, `foo`, s],
          bar: [`b`, `bar`, s],
          baz: [`c`, `baz`, s],
        }, s],
      );

      expect(
        configUtils.resolveRcFiles([
          [`a`, {foo: `foo`}],
          [`b`, {onConflict: `reset`, bar: `bar`}],
          [`c`, {baz: `baz`}],
        ]),
      ).toEqual(
        [`b, c`, {
          bar: [`b`, `bar`, s],
          baz: [`c`, `baz`, s],
        }, s],
      );

      expect(
        configUtils.resolveRcFiles([
          [`a`, {foo: `foo`}],
          [`b`, {onConflict: `reset`, value: {bar: `bar`}}],
          [`c`, {baz: `baz`}],
        ]),
      ).toEqual(
        [`b, c`, {
          bar: [`b`, `bar`, s],
          baz: [`c`, `baz`, s],
        }, s],
      );

      expect(
        configUtils.resolveRcFiles([
          [`a`, {foo: {hello: `hello`}, bar: 42}],
          [`b`, {onConflict: `reset`, foo: {onConflict: `extend`, world: `world`}}],
        ]),
      ).toEqual(
        [`b`, {
          foo: [
            `a, b`,
            {hello: [`a`, `hello`, s], world: [`b`, `world`, s]},
            s,
          ],
        }, s],
      );

      expect(
        configUtils.resolveRcFiles([
          [`a`, {foo: {hello: `hello`}, bar: 42}],
          [`b`, 42],
          [`c`, {onConflict: `reset`, foo: {onConflict: `extend`, world: `world`}}],
        ]),
      ).toEqual(
        [`c`, {
          foo: [`c`, {world: [`c`, `world`, s]}, s],
        }, s],
      );

      expect(
        configUtils.resolveRcFiles([
          [`a`, {foo: {hello: `hello`}, bar: 42}],
          [`b`, undefined],
          [`c`, {onConflict: `reset`, foo: {onConflict: `extend`, world: `world`}}],
        ]),
      ).toEqual(
        [`c`, {
          foo: [`a, c`, {
            hello: [`a`, `hello`, s],
            world: [`c`, `world`, s],
          }, s],
        }, s],
      );
    });
  });
});
