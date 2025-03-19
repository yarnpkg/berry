/**
 * A cache map with reference counting. This map is designed to handle
 * a resource that has native/wasm handles which need to be release explicitly.
 * It also requires the value to have a unique map to cache instanches
 */
export class RefCountedCache<TKey, TValue> {
  private map: Map<TKey, {value: TValue, refCount: number}>;

  /**
   * Creates a new RefCountedMap.
   * @param releaseFunction The function to release the native resources.
   */
  constructor(private releaseFunction: (value: TValue) => void) {
    this.map = new Map<TKey, {value: TValue, refCount: number}>();
  }

  /**
   *
   * @param key A unique key to indentify the instance in this Map
   * @param createInstance The function to create a new instance of TValue if none already esists
   * @returns The value form the cache (or newly created when not present) as well as the release function
   * to call when the object is to be released.
   */
  addOrCreate(key: TKey, createInstance: () => TValue): {value: TValue, release: () => void} {
    const result = this.map.get(key);
    if (result) {
      // We had an existing value.
      if (result.refCount <= 0)
        throw new Error(`Race condition in RefCountedMap. While adding a new key the refCount is: ${result.refCount} for ${JSON.stringify(key)}`);

      // Update the refcount.
      result.refCount++;
      return {
        value: result.value,
        release: () => this.release(key),
      };
    } else {
      // we had not seen this before, create the instance and register a refCount of 1.
      const newValue = createInstance();
      this.map.set(key, {refCount: 1, value: newValue});
      return {
        value: newValue,
        release: () => this.release(key),
      };
    }
  }

  /**
   * Releases the object by decreasing the refcount. When the last reference is released (i.e. the refcount goes to 0)
   * This function will call to the releaseFunction passed to the cache map to release the native resources.
   */
  private release(key: TKey): void {
    const result = this.map.get(key);
    if (!result)
      throw new Error(`Unbalanced calls to release. No known instances of: ${JSON.stringify(key)}`);


    const refCount = result.refCount;
    if (refCount <= 0) {
      throw new Error(`Unbalanced calls to release. Too many release vs alloc refcount would become: ${refCount - 1} of ${JSON.stringify(key)}`);
    } else if (refCount == 1) {
      // This is the last used item. Remove the value from the map and call the releaseFunction to free the native resources
      this.map.delete(key);
      this.releaseFunction(result.value);
    } else {
      result.refCount--;
    }
  }
}
