import Module from 'module';

declare var __non_webpack_require__: any;

export function dynamicRequire(request: string): any {
  const req = typeof __non_webpack_require__ !== `undefined`
    ? __non_webpack_require__
    : require;

  return req(request);
}

export function builtinModules(): Set<string> {
  // @ts-ignore
  return new Set(Module.builtinModules || Object.keys(process.binding(`natives`)));
}
