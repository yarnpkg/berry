import {Node}                                                                from './Node';
import {DEFAULT_COMPUTED_STYLES, DEFAULT_INHERITED_STYLES, COMPOSITE_STYLES} from './StyleConfiguration';
import {STYLE_CONVERTERS, STYLE_TRIGGERS}                                    from './StyleConfiguration';
import {INHERITED_STYLE_PROPERTY}                                            from './StyleConfiguration';

export type StyleMap = Map<string, any>;

export class StyleManager {
  private readonly node: Node;

  private readonly computed: Map<string, any> = new Map();
  private readonly inherited: Set<string> = new Set(DEFAULT_INHERITED_STYLES);

  constructor(node: Node) {
    this.node = node;
  }

  get(key: string): any {
    const computed = this.computed.get(key);

    if (computed !== undefined) {
      return computed;
    } else {
      return DEFAULT_COMPUTED_STYLES.get(key);
    }
  }

  refreshInheritedProperties() {
    const inheritedProperties: StyleMap = new Map();

    for (const inherited of this.inherited)
      inheritedProperties.set(inherited, INHERITED_STYLE_PROPERTY);

    this.applyProperties(inheritedProperties);
  }

  setProperties(source: StyleMap) {
    const mappedSource: StyleMap = new Map(source);
    const comprehensiveSource: StyleMap = new Map();

    const traverseStyleProperty = (key: string, value: any) => {
      let compositeStyleBuilder = COMPOSITE_STYLES.get(key);

      if (compositeStyleBuilder) {
        const compositeStyle = compositeStyleBuilder(value);

        for (let key of Object.keys(compositeStyle)) {
          if (!mappedSource.has(key)) {
            traverseStyleProperty(key, compositeStyle[key]);
          }
        }
      } else {
        comprehensiveSource.set(key, value);
      }
    };

    for (let [key, value] of mappedSource.entries())
      traverseStyleProperty(key, value);

    for (let key of this.computed.keys())
      if (!comprehensiveSource.has(key))
        comprehensiveSource.set(key, undefined);

    this.applyProperties(comprehensiveSource);
  }

  applyProperties(source: StyleMap) {
    const computedProperties: StyleMap = new Map();

    let applyStyleProperty = (key: string, value: any) => {
      const compositeStyleBuilder = COMPOSITE_STYLES.get(key);

      if (compositeStyleBuilder) {
        const compositeStyle = compositeStyleBuilder(value);

        for (let key of Object.keys(compositeStyle)) {
          if (!source.has(key)) {
            applyStyleProperty(key, compositeStyle[key]);
          }
        }
      } else {
        if (value === `inherit`) {
          value = INHERITED_STYLE_PROPERTY;
        } else {
          const converter = STYLE_CONVERTERS.get(key);
          if (converter) {
            value = converter(value);
          }
        }

        computedProperties.set(key, value);
      }
    };

    for (const [key, value] of source.entries())
      applyStyleProperty(key, value);

    this.applyComputedProperties(computedProperties);
  }

  private applyComputedProperties(source: StyleMap) {
    const dirtyKeys: Set<string> = new Set();

    for (let [key, value] of source.entries()) {
      const defaultValue: any = DEFAULT_COMPUTED_STYLES.get(key);

      if (value === undefined)
        value = DEFAULT_INHERITED_STYLES.has(key) ? INHERITED_STYLE_PROPERTY : defaultValue;

      if (value === INHERITED_STYLE_PROPERTY)
        this.inherited.add(key);
      else
        this.inherited.delete(key);

      if (value === INHERITED_STYLE_PROPERTY)
        value = this.node.parentNode ? this.node.parentNode.style.get(key) : defaultValue;

      if (value === this.get(key))
        continue;

      dirtyKeys.add(key);

      if (value === defaultValue) {
        this.computed.delete(key);
      } else {
        this.computed.set(key, value);
      }
    }

    for (const key of dirtyKeys) {
      const trigger = STYLE_TRIGGERS.get(key);

      if (trigger) {
        trigger(this.node, this.get(key));
      }
    }

    for (const child of this.node.childNodes) {
      const inheritedComputedProperties: StyleMap = new Map();

      for (let key of child.style.inherited)
        if (dirtyKeys.has(key))
          inheritedComputedProperties.set(key, INHERITED_STYLE_PROPERTY);

      child.style.applyComputedProperties(inheritedComputedProperties);
    }
  }
}
