import * as yup from 'yup';

yup.addMethod(yup.object, `atMostOneOf`, function (list: Array<string>) {
  return this.test({
    name: `atMostOneOf`,
    message: `\${path} must only have at most one of these keys: \${keys}`,
    params: {keys: list.join(`, `)},
    test: value => value === null || list.filter(f => !!value[f]).length <= 1,
  });
});

declare module 'yup' {
  interface ObjectSchema<T extends object> {
    atMostOneOf(keys: Array<string>): this;
  }
}
