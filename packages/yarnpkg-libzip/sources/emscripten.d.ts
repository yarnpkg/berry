/// <reference types="emscripten" />

export interface LibzipEmscriptenModule extends EmscriptenModule {
  cwrap: typeof cwrap;
  getValue: typeof getValue;
}
