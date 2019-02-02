import {Node} from './Node';

export type EventDefault = () => void;

export type EventOptions = {
  bubbles: boolean,
  cancelable: boolean,
};

export type EventData = {
  [key: string]: any,
};

export class SyntheticEvent {
  public readonly name: string;

  public readonly bubbles: boolean;
  public readonly cancelable: boolean;

  public immediatlyCanceled: boolean = false;
  public propagationStopped: boolean = false;

  public defaultPrevented: boolean = false;
  public default: EventDefault | null = null;

  public target: Node | null = null;
  public currentTarget: Node | null = null;

  [key: string]: any;

  constructor(name: string, {bubbles = false, cancelable = false}: Partial<EventOptions> = {}, attrs: EventData = {}) {
    this.name = name;

    this.bubbles = bubbles;
    this.cancelable = cancelable;

    for (let [key, value] of Object.entries(attrs)) {
      this[key] = value;
    }
  }

  reset() {
    this.immediatlyCanceled = false;
    this.bubblingCanceled = false;

    this.defaultPrevented = false;
    this.default = null;

    this.target = null;
    this.currentTarget = null;

    return this;
  }

  stopImmediatePropagation() {
    this.immediatlyCanceled = true;
    this.propagationStopped = true;
  }

  stopPropagation() {
    this.propagationStopped = true;
  }

  preventDefault() {
    if (!this.cancelable)
      throw new Error(`Failed to execute 'preventDefault': Event is not cancelable.`);

    this.defaultPrevented = true;
  }

  setDefault(callback: EventDefault | null) {
    this.default = callback;
  }

  inspect() {
    const defaultPrevented = this.defaultPrevented ? ` (default prevented)` : ``;

    return `<Event ${this.name}${defaultPrevented}>`;
  }
}
