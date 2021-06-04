import Module from 'module';

export function builtinModules(): Set<string> {
  // @ts-expect-error
  return new Set(Module.builtinModules || Object.keys(process.binding(`natives`)));
}
