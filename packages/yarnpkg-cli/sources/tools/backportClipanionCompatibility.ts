export function backportClipanionCompatibility(clipanion: any) {
  clipanion.Command.Path = (...p: Array<any>) => (instance: any) => {
    instance.paths = instance.paths || [];
    instance.paths.push(p);
  };

  for (const fn of [`Array`, `Boolean`, `String`, `Proxy`, `Rest`, `Counter`]) {
    clipanion.Command[fn] = (...args: Array<any>) => (instance: any, propertyName: any) => {
      const value = clipanion.Option[fn](...args);
      Object.defineProperty(instance, `__${propertyName}`, {
        configurable: false,
        enumerable: true,
        get() {
          return value;
        },
        set(value) {
          this[propertyName] = value;
        },
      });
    };
  }

  return clipanion;
}
