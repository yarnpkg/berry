import {Environment}             from './Environment';
import {KeySequence}             from './KeySequence';
import {NodeTree}                from './NodeTree';
import {Node, NodeType}          from './Node';
import {DEFAULT_COMPUTED_STYLES} from './StyleConfiguration';
import {Props}                   from './types';

export class NodeElement extends Node {
  public props: Props = {};

  private shortcutStores: Map<NodeElement | null, Map<string, (event: any) => void>> = new Map();

  constructor(env: Environment, props: Props = {}) {
    super(env, NodeType.ELEMENT);

    this.setProps(props);
  }

  setProps(props: Props) {
    this.props = Object.assign({}, props);

    // Forces this node to forward all its shortcuts to its "shortcuts" map
    this.props.onShortcut = (event: any) => {
      for (const shortcuts of this.shortcutStores.values()) {
        const callback = shortcuts.get(event.shortcut);
        callback && callback(event);
      }
    };

    // Registers all shortcuts into the global listener from the tree
    this.setShortcuts(null, props.shortcuts || {});

    // Attach all the global shortcuts to the root node, under our namespace
    if (this.rootNode)
      this.rootNode.setShortcuts(this, props.globalShortcuts);

    // Updates the node style properties
    this.style.setProperties(new Map(Object.entries(props.style || {})));
  }

  setShortcuts(namespace: NodeElement | null, shortcutDefinitions: {[shortcut: string]: () => void}) {
    const shortcuts = new Map();

    for (const [shortcut, callback] of Object.entries(shortcutDefinitions || {})) {
      const normalizedShortcut = KeySequence.normalize(shortcut);

      if (shortcuts.has(normalizedShortcut))
        throw new Error(`Multiple shortcuts share the same underlying event (${normalizedShortcut})`);

      shortcuts.set(normalizedShortcut, callback);
    }

    const currentShortcuts = this.shortcutStores.get(namespace) || new Map();

    const oldShortcuts = new Set(currentShortcuts.keys());
    const newShortcuts = new Set(shortcuts.keys());

    // We need a second copy because the first one will get mutated
    const tempShortcuts = new Set(shortcuts.keys());

    for (const shortcut of oldShortcuts)
      newShortcuts.delete(shortcut);
    for (const shortcut of tempShortcuts)
      oldShortcuts.delete(shortcut);

    if (this.rootNode) {
      for (const shortcut of newShortcuts)
        this.rootNode.addShortcutReference(shortcut);
      for (const shortcut of oldShortcuts) {
        this.rootNode.removeShortcutReference(shortcut);
      }
    }

    this.shortcutStores.set(namespace, shortcuts);
  }

  linkSelf(rootNode: NodeTree, parentNode: Node) {
    if (this.rootNode)
      this.rootNode.setShortcuts(this, this.props.globalShortcuts);

    for (const shortcuts of this.shortcutStores.values()) {
      for (const shortcut of shortcuts.keys()) {
        rootNode.addShortcutReference(shortcut);
      }
    }
  }

  unlinkSelf(rootNode: NodeTree, parentNode: Node) {
    rootNode.shortcutStores.delete(this);

    for (const shortcuts of this.shortcutStores.values()) {
      for (const shortcut of shortcuts.keys()) {
        rootNode.removeShortcutReference(shortcut);
      }
    }
  }

  dumpNode(depth: number = 0) {
    const indent = `  `.repeat(depth);
    const layout = this.yoga.getComputedLayout();

    const style: {[key: string]: any} = {};

    for (const key of DEFAULT_COMPUTED_STYLES.keys())
      if (DEFAULT_COMPUTED_STYLES.get(key) !== this.style.get(key))
        style[key] = this.style.get(key);

    console.log(indent + `<div layout={${JSON.stringify(layout)}}${style ? ` style={${JSON.stringify(style)}}` : ``}>`);

    for (const child of this.childNodes)
      child.dumpNode(depth + 1);

    console.log(indent + `</div>`);
  }

  getLine(row: number, left: number, width: number) {
    if (!(left >= 0 && left < this.elementWorldRect.width))
      throw new Error(`Out-of-bound segment start`);
    if (!(width >= 0 && width <= this.elementWorldRect.width - left))
      throw new Error(`Invalid segment width`);

    if (!width)
      return ``;

    if (row === 0) {
      const borderTop = this.style.get(`borderTop`);

      if (borderTop) {
        let prefix = ``, suffix = ``;

        if (this.elementWorldRect.width >= 2) {
          if (left === 0) {
            const borderLeft = this.style.get(`borderLeft`);

            if (borderLeft) {
              prefix = this.style.get(`borderTopLeft`);
              left += 1;
              width -= 1;
            }
          }

          if (left + width === this.elementWorldRect.width) {
            const borderRight = this.style.get(`borderRight`);

            if (borderRight) {
              suffix = this.style.get(`borderTopRight`);
              width -= 1;
            }
          }
        }

        return this.applyTextStyle(prefix + borderTop.repeat(width) + suffix, {
          backColor: this.style.get(`borderBackColor`),
          frontColor: this.style.get(`borderFrontColor`),
        });
      }
    }

    if (row === this.elementWorldRect.height - 1) {
      const borderBottom = this.style.get(`borderBottom`);

      if (borderBottom) {
        let prefix = ``, suffix = ``;

        if (this.elementWorldRect.width >= 2) {
          if (left === 0) {
            const borderLeft = this.style.get(`borderLeft`);

            if (borderLeft) {
              prefix = this.style.get(`borderBottomLeft`);
              left += 1;
              width -= 1;
            }
          }

          if (left + width === this.elementWorldRect.width) {
            const borderRight = this.style.get(`borderRight`);

            if (borderRight) {
              suffix = this.style.get(`borderBottomRight`);
              width -= 1;
            }
          }
        }

        return this.applyTextStyle(prefix + borderBottom.repeat(width) + suffix, {
          backColor: this.style.get(`borderBackColor`),
          frontColor: this.style.get(`borderFrontColor`),
        });
      }
    }

    let prefix = ``, suffix = ``;

    if (left === 0) {
      const borderLeft = this.style.get(`borderLeft`);

      if (borderLeft) {
        prefix = borderLeft;
        left += 1;
        width -= 1;
      }
    }

    if (left + width === this.elementWorldRect.width) {
      const borderRight = this.style.get(`borderRight`);

      if (borderRight) {
        suffix = borderRight;
        width -= 1;
      }
    }

    if (prefix) {
      prefix = this.applyTextStyle(prefix, {
        backColor: this.style.get(`borderBackColor`),
        frontColor: this.style.get(`borderFrontColor`),
      });
    }

    if (suffix) {
      suffix = this.applyTextStyle(suffix, {
        backColor: this.style.get(`borderBackColor`),
        frontColor: this.style.get(`borderFrontColor`),
      });
    }

    if (this.props.renderFn) {
      const renderText = (text: string) => {
        return this.applyTextStyle(text);
      };

      const renderBackground = (width: number) => {
        return this.applyTextStyle(this.style.get(`background`).repeat(width), {
          frontColor: this.style.get(`backgroundFrontColor`),
        });
      };

      const content = this.props.renderFn(row, left, width, renderText, renderBackground);

      return prefix + content + suffix;
    } else {
      const pad = this.applyTextStyle(this.style.get(`background`).repeat(width), {
        frontColor: this.style.get(`backgroundFrontColor`),
      });

      return prefix + pad + suffix;
    }
  }
}
