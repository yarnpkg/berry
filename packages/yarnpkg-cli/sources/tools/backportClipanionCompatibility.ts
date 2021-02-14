export function backportClipanionCompatibility(clipanion: any) {
  clipanion.Command.Path = (...p: Array<any>) => (instance: any) => {
    instance.paths = instance.paths || [];
    instance.paths.push(p);
  };

  for (const fn of [`Array`, `Boolean`, `String`]) {
    clipanion.Command[fn] = (...args: Array<any>) => (instance: any, propertyName: any) => {
      Object.defineProperty(instance, propertyName, {
        configurable: false,
        enumerable: true,
        value: clipanion.Option[fn](...args),
        writable: true,
      });
    };
  }

  return clipanion;
}
