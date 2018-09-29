// @ts-ignore
import {style}          from '@manaflair/term-strings';

import {DirtyScreen}    from './DirtyScreen';
import {Environment}    from './Environment';
import {KeySequence}    from './KeySequence';
import {NodeElement}    from './NodeElement';
import {Node}           from './Node';
import {SyntheticEvent} from './SyntheticEvent';

export class NodeTree extends NodeElement {
  private readonly renderFn: () => void;
  private readonly shutdownFn: () => void;

  private width: number | null = null;
  private height: number | null = null;

  private renderList: Array<Node> | null = null;

  private activeElement: NodeElement | null = null;

  private mouseOverElement: NodeElement | null = null;
  private mouseEnterElements: Array<NodeElement> = [];

  private readonly monitoredShortcuts: Map<string, {keySequence: KeySequence, refCount: number}> = new Map();

  constructor(env: Environment, renderFn: () => void, shutdownFn: () => void) {
    super(env);

    this.rootNode = this;

    this.renderFn = renderFn;
    this.shutdownFn = shutdownFn;

    this.refreshProps();
  }

  requestRender() {
    this.renderFn();
  }

  requestShutdown() {
    this.shutdownFn();
  }

  resize(width: number | null, height: number | null) {
    this.width = width;
    this.height = height;

    this.refreshProps();
  }

  getElementAt(x: number, y: number) {
    if (!this.renderList)
      throw new Error(`Assertion failed: the render list should be available`);

    for (const node of this.renderList) {
      if (!(node instanceof NodeElement))
        continue;

      if (x < node.elementClipRect.left || x >= node.elementClipRect.left + node.elementClipRect.width)
        continue;
      if (y < node.elementClipRect.top || y >= node.elementClipRect.top + node.elementClipRect.height)
        continue;

      return node;
    }

    return null;
  }

  focus(element: NodeElement | null) {
    if (element && element.props.tabIndex === null)
      element = null;

    const previousElement = this.activeElement;
    const currentElement = this.activeElement = element;

    if (previousElement)
      previousElement.dispatchEvent(new SyntheticEvent(`blur`));

    if (currentElement) {
      currentElement.dispatchEvent(new SyntheticEvent(`focus`));
    }
  }

  addShortcutReference(shortcut: string) {
    const keySequence = new KeySequence(shortcut);
    const keySequenceName = keySequence.name;

    let monitorEntry = this.monitoredShortcuts.get(keySequenceName);

    // Register the sequence if it doesn't exist yet
    if (!monitorEntry)
      this.monitoredShortcuts.set(keySequenceName, monitorEntry = {keySequence, refCount: 0});

    monitorEntry.refCount += 1;
  }

  removeShortcutReference(shortcut: string) {
    const keySequence = new KeySequence(shortcut);
    const keySequenceName = keySequence.name;

    const monitorEntry = this.monitoredShortcuts.get(keySequenceName);

    if (!monitorEntry)
      throw new Error(`Assertion failed: the specified shortcut isn't referenced`);

    // Remove the sequence if nothing references it anymore
    if ((monitorEntry.refCount -= 1) === 0) {
      this.monitoredShortcuts.delete(shortcut);
    }
  }

  emitMouse(mouse: any) {
    const targetElement = this.getElementAt(mouse.x, mouse.y);

    if (!targetElement)
      return;

    if (mouse.name === `wheel`) {
      targetElement.dispatchEvent(new SyntheticEvent(`wheel`, {bubbles: true}, {mouse}));
    } else {
      if (mouse.start) {
        targetElement.dispatchEvent(new SyntheticEvent(`mouseDown`, {bubbles: true}, {mouse}));

        if (mouse.name === `left`)
          targetElement.dispatchEvent(new SyntheticEvent(`click`, {bubbles: true}, {mouse}));

        let focusElement: NodeElement | null = null;

        for (let node: Node | null = targetElement; !focusElement && node; node = node.parentNode)
          if (node instanceof NodeElement && node.props.tabIndex !== null)
            focusElement = node;

        this.focus(focusElement);
      }

      if (mouse.end)
        targetElement.dispatchEvent(new SyntheticEvent(`mouseUp`, {bubbles: true}, {mouse}));

      if (!mouse.start && !mouse.end) {
        this.emitMouseOver(mouse);
        this.emitMouseEnter(mouse);

        targetElement.dispatchEvent(new SyntheticEvent(`mouseMove`, {bubbles: true}, {mouse}));
      }
    }
  }

  private emitMouseOver(mouse: any) {
    const targetElement = this.getElementAt(mouse.x, mouse.y);

    if (targetElement === this.mouseOverElement)
      return;

    const previousElement = this.mouseOverElement;
    const currentElement = this.mouseOverElement = targetElement;

    if (previousElement)
      previousElement.dispatchEvent(new SyntheticEvent(`mouseOut`, {bubbles: true}, {mouse}));

    if (currentElement) {
      currentElement.dispatchEvent(new SyntheticEvent(`mouseOver`, {bubbles: true}, {mouse}));
    }
  }

  private emitMouseEnter(mouse: any) {
    const targetElement = this.getElementAt(mouse.x, mouse.y);

    const index = targetElement
      ? this.mouseEnterElements.indexOf(targetElement)
      : -1;

    let removedElements = [];
    const addedElements = [];

    if (index !== -1) {
      removedElements = this.mouseEnterElements.splice(index + 1, this.mouseEnterElements.length);
    } else {
      let currentNode: Node | null = targetElement;
      let currentIndex = index;

      while (currentNode && currentIndex === -1) {
        if (currentNode instanceof NodeElement)
          addedElements.unshift(currentNode);

        currentNode = currentNode.parentNode;

        if (currentNode instanceof NodeElement) {
          currentIndex = this.mouseEnterElements.indexOf(currentNode);
        }
      }

      if (currentNode) {
        removedElements = this.mouseEnterElements.splice(currentIndex + 1, this.mouseEnterElements.length);
      } else {
        removedElements = this.mouseEnterElements.splice(0, this.mouseEnterElements.length);
      }
    }

    this.mouseEnterElements = this.mouseEnterElements.concat(addedElements);

    for (let t = removedElements.length - 1; t >= 0; --t)
      removedElements[t].dispatchEvent(new SyntheticEvent(`mouseLeave`, {}, {mouse}));

    for (let t = 0; t < addedElements.length; ++t) {
      addedElements[t].dispatchEvent(new SyntheticEvent(`mouseEnter`, {}, {mouse}));
    }
  }

  emitKey(key: any) {
    const targetElement = this.activeElement || this;
    const shortcutEvents = [];

    for (let monitoredShortcut of this.monitoredShortcuts.values())
      if (monitoredShortcut.keySequence.add(key))
        shortcutEvents.push(new SyntheticEvent(`shortcut`, {bubbles: true}, {shortcut: monitoredShortcut.keySequence.name}));

    for (let event of shortcutEvents)
      targetElement.dispatchEvent(event);

    targetElement.dispatchEvent(new SyntheticEvent(`key`, {}, {key}));
  }

  emitData(buffer: Buffer) {
    const targetElement = this.activeElement || this;

    targetElement.dispatchEvent(new SyntheticEvent(`data`, {}, {buffer}));
  }

  refreshRenderList() {
    if (this.renderList)
      return this.renderList;

    const renderList: Array<Node> = this.renderList = [this];

    const contexts: Array<Node> = [this];

    while (contexts.length > 0) {
      const context = contexts.shift() as Node;
      renderList.unshift(context);

      const children = context.childNodes.slice();
      const subContexts = [];

      while (children.length > 0) {
        const node = children.shift() as Node;

        if (node.requiresStackingContext) {
          subContexts.push(node);
        } else {
          renderList.unshift(node);
          children.splice(0, 0, ...node.childNodes);
        }
      }

      contexts.splice(0, 0, ...subContexts.sort((a, b) => {
        return a.layerIndex - b.layerIndex;
      }));
    }

    return renderList;
  }

  private refreshProps() {
    this.setProps({
      shortcuts: {
        [`ctrl-c`]: () => this.requestShutdown(),
      },
      style: {
        width: this.width,
        height: this.height,
      },
    });
  }
};
