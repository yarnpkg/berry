type KeySequenceOptions = {
  ctrl: boolean,
  alt: boolean,
  shift: boolean,
  meta: boolean,
};

class KeySequenceEntry {
  private readonly ctrl: boolean;
  private readonly alt: boolean;
  private readonly meta: boolean;
  private readonly shift: boolean;

  private readonly key: string;
  public readonly name: string = ``;

  static parse(string: string) {
    const parts = string.split(/[+-]/g);

    let ctrl = false;
    let alt = false;
    let meta = false;
    let shift = false;

    let key: string = ``;

    for (let t = 0; t < parts.length; ++t) {
      const part = parts[t];

      if (t !== parts.length - 1) {
        switch (part.toLowerCase()) {
          case `ctrl`:
          case `c`: {
            ctrl = true;
          } break;

          case `alt`:
          case `a`: {
            alt = true;
          } break;

          case `shift`:
          case `s`: {
            shift = true;
          } break;

          case `meta`:
          case `m`: {
            meta = true;
          } break;

          default: {
            throw new Error(`Failed to parse shortcut descriptor: Invalid modifier "${part}".`);
          } break;
        }
      } else {
        key = part.toLowerCase();
      }
    }

    return new KeySequenceEntry(key, {ctrl, alt, shift, meta});
  }

  constructor(key: string, {ctrl = false, alt = false, meta = false, shift = false}: Partial<KeySequenceOptions> = {}) {
    this.ctrl = ctrl;
    this.alt = alt;
    this.shift = shift;
    this.meta = meta;

    this.key = key;

    if (ctrl)
      this.name += `ctrl-`;
    if (alt)
      this.name += `alt-`;
    if (shift)
      this.name += `shift-`;
    if (meta)
      this.name += `meta-`;

    this.name += key;
  }

  check(key: any) {
    if (this.shift !== key.shift)
      return false;

    if (this.alt !== key.alt)
      return false;

    if (this.ctrl !== key.ctrl)
      return false;

    if (this.meta !== key.meta)
      return false;

    if (this.key !== key.name)
      return false;

    return true;
  }
}

export class KeySequence {
  private readonly keyBuffer: Array<any> = [];

  private readonly descriptor: string;
  private readonly entries: Array<KeySequenceEntry>;

  public readonly name: string = ``;

  static normalize(descriptor: string) {
    return new KeySequence(descriptor).name;
  }

  constructor(descriptor: string) {
    this.descriptor = descriptor;
    this.entries = String(this.descriptor).trim().toLowerCase().split(/\s+/g).map(descriptor => KeySequenceEntry.parse(descriptor.trim()));

    for (const entry of this.entries)
      this.name += entry.name.charAt(0).toUpperCase() + entry.name.slice(1);

    this.name = this.name.charAt(0).toLowerCase() + this.name.slice(1);
  }

  add(key: any) {
    this.keyBuffer.push(key);

    // Remove any extraneous key (we only match the last Nth keys)
    if (this.keyBuffer.length > this.entries.length)
      this.keyBuffer.splice(0, this.keyBuffer.length - this.entries.length);

    // Early return if we haven't bufferized enough keys to match anyway
    if (this.keyBuffer.length < this.entries.length)
      return false;

    // Check that every buffered key match its corresponding entry
    for (let t = 0, T = this.entries.length; t < T; ++t)
      if (!this.entries[t].check(this.keyBuffer[t]))
        return false;

    return true;
  }

}
