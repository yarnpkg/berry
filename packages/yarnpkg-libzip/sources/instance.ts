import {Libzip} from './makeInterface';

export let cachedInstance: Libzip | undefined;

let registeredFactory: () => Libzip = () => {
  throw new Error(`Assertion failed: No libzip instance is available, and no factory was configured`);
};

export function setFactory(factory: () => Libzip) {
  registeredFactory = factory;
}

export function getInstance() {
  if (typeof cachedInstance === `undefined`)
    cachedInstance = registeredFactory();

  return cachedInstance;
}

export function tryInstance() {
  return cachedInstance;
}
