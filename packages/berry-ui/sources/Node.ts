import {DirtyScreen}                    from './DirtyScreen';
import {Environment}                    from './Environment';
import {NodeElement}                    from './NodeElement';
import {NodeTree}                       from './NodeTree';
import {Rect}                           from './Rect';
import {StyleManager}                   from './StyleManager';
import {getColorEntry}                  from './colors';
import {computeInPlaceIntersectingRect} from './geometryUtils';

enum Flags {
  NODE_HAS_DIRTY_LAYOUT = 1 << 0,
  NODE_HAS_DIRTY_LAYOUT_CHILDREN = 1 << 1,

  NODE_HAS_DIRTY_CLIPPING = 1 << 2,
  NODE_HAS_DIRTY_CLIPPING_CHILDREN = 1 << 3,

  NODE_HAS_DIRTY_RENDER = 1 << 4,
  NODE_HAS_DIRTY_RENDER_CHILDREN = 1 << 5,
}

export enum NodeType {
  TEXT,
  ELEMENT,
}

export abstract class Node {
  public readonly env: Environment;
  public readonly yoga: any;

  public readonly type: NodeType;

  public rootNode: NodeTree | null = null;
  public parentNode: Node | null = null;

  public firstChild: Node | null = null;
  public lastChild: Node | null = null;

  public previousSibling: Node | null = null;
  public nextSibling: Node | null = null;

  public readonly childNodes: Array<Node> = [];

  public readonly elementRect: Rect = new Rect();
  public readonly contentRect: Rect = new Rect();

  public readonly elementWorldRect: Rect = new Rect();
  public readonly contentWorldRect: Rect = new Rect();

  public readonly elementClipRect: Rect = new Rect();
  public readonly contentClipRect: Rect = new Rect();

  public readonly scrollRect: Rect = new Rect();

  public readonly style: StyleManager = new StyleManager(this);

  public requiresStackingContext: boolean = false;
  public layerIndex: number = 0;

  private flags: number = 0;

  // Used to detect when a cached value changes
  private trackers: Map<string, Array<any>> = new Map();

  constructor(env: Environment, type: NodeType) {
    this.env = env;

    this.yoga = new env.yoga.Node();
    // We prevent extensions to be sure we don't accidentally make typos in the property names
    Object.seal(this.yoga);

    this.type = type;

    this.style = new StyleManager(this);
  }

  prependChild(node: Node) {
    if (node.parentNode)
      throw new Error(`Assertion failed: A node cannot be reparented`);

    node.parentNode = this;

    if (this.firstChild) {
      node.nextSibling = this.firstChild;
      node.nextSibling.previousSibling = node;

      this.firstChild = node;

      this.yoga.insertChild(node.yoga, 0);
      this.childNodes.unshift(node);
    } else {
      this.firstChild = node;
      this.lastChild = node;

      this.yoga.insertChild(node.yoga, 0);
      this.childNodes.unshift(node);
    }

    if (this.rootNode)
      node.linkRecursive();

    this.markDirtyLayoutChildren();
  }

  appendChild(node: Node) {
    if (node.parentNode)
      throw new Error(`Assertion failed: A node cannot be reparented`);

    node.parentNode = this;

    if (this.lastChild) {
      node.previousSibling = this.lastChild;
      node.previousSibling.nextSibling = node;

      this.lastChild = node;

      this.yoga.insertChild(node.yoga, this.childNodes.length);
      this.childNodes.push(node);
    } else {
      this.firstChild = node;
      this.lastChild = node;

      this.yoga.insertChild(node.yoga, this.childNodes.length);
      this.childNodes.push(node);
    }

    node.style.refreshInheritedProperties();

    if (this.rootNode)
      node.linkRecursive();

    this.markDirtyLayoutChildren();
  }

  insertBefore(node: Node, before: Node | null) {
    if (before === null)
      return this.appendChild(node);

    if (before.parentNode !== this)
      throw new Error(`Assertion failed: Cannot locate a node that isn't owned`);

    const index = this.childNodes.indexOf(before);

    if (index === -1)
      throw new Error(`Assertion failed: Cannot locate a node that's been removed`);

    if (index === 0)
      return this.prependChild(node);

    if (node.parentNode)
      throw new Error(`Assertion failed: A node cannot be reparented`);

    if (!before.previousSibling) // required to help typescript figure out this is true
      throw new Error(`Assertion failed: There should be a previous sibling`);

    node.parentNode = this;

    node.previousSibling = before.previousSibling;
    node.nextSibling = before;

    node.previousSibling.nextSibling = node;
    node.nextSibling.previousSibling = node;

    this.yoga.insertChild(node.yoga, index);
    this.childNodes.splice(index, 0, node);

    node.style.refreshInheritedProperties();

    if (this.rootNode)
      node.linkRecursive();

    this.markDirtyLayoutChildren();
  }

  removeChild(node: Node) {
    if (node.parentNode !== this)
      throw new Error(`Assertion failed: Cannot remove a node that isn't owned`);

    const index = this.childNodes.indexOf(node);

    if (index === -1)
      throw new Error(`Assertion failed: Cannot remove a node twice`);

    const previousSibling = node.previousSibling;
    const nextSibling = node.nextSibling;

    if (node.rootNode)
      node.unlinkRecursive();

    this.yoga.removeChild(node.yoga);
    node.childNodes.splice(index, 1);

    if (previousSibling)
      previousSibling.nextSibling = nextSibling;

    if (nextSibling)
      nextSibling.previousSibling = previousSibling;

    if (this.firstChild === node)
      this.firstChild = nextSibling;

    if (this.lastChild === node)
      this.lastChild = previousSibling;

    this.markDirtyLayoutChildren();
  }

  dispatchEvent(event: any) {
    const eventSources: Array<NodeElement> = [];

    for (let eventSource: Node | null = this; eventSource; eventSource = eventSource.parentNode)
      if (eventSource instanceof NodeElement)
        eventSources.unshift(eventSource);

    event.target = this;

    for (const eventSource of eventSources) {
      if (event.propagationStopped)
        break;

      const handlerName = `on${event.name.charAt(0).toUpperCase()}${event.name.slice(1)}Capture`;
      const handler = eventSource.props[handlerName];

      if (!handler)
        continue;

      event.currentTarget = eventSource;
      handler.call(null, event);

    }

    for (let eventSource of eventSources) {

      if (event.propagationStopped)
        break;

      let handlerName = `on${event.name.charAt(0).toUpperCase()}${event.name.slice(1)}`;
      let handler = eventSource.props[handlerName];

      if (!handler)
        continue;

      event.currentTarget = eventSource;
      handler.call(null, event);

      if (!event.bubbles) {
        break;
      }

    }

    if (event.default && !event.defaultPrevented) {
      event.default.call(null, event);
    }
  }

  getPreferredScrollSize() {
    const width = this.elementRect.width;
    const height = this.elementRect.height;

    return {width, height};
  }

  markDirtyLayoutChildren() {
    this.flags |= Flags.NODE_HAS_DIRTY_LAYOUT | Flags.NODE_HAS_DIRTY_LAYOUT_CHILDREN;

    for (let parent = this.parentNode; parent; parent = parent.parentNode) {
      if (parent.flags & Flags.NODE_HAS_DIRTY_LAYOUT_CHILDREN)
        break;
      parent.flags |= Flags.NODE_HAS_DIRTY_LAYOUT_CHILDREN;
    }

    for (const child of this.childNodes) {
      child.flags |= Flags.NODE_HAS_DIRTY_LAYOUT;
    }
  }

  markDirtyLayout() {
    this.flags |= Flags.NODE_HAS_DIRTY_LAYOUT;

    for (let parent = this.parentNode; parent; parent = parent.parentNode) {
      if (parent.flags & Flags.NODE_HAS_DIRTY_LAYOUT_CHILDREN)
        break;
      parent.flags |= Flags.NODE_HAS_DIRTY_LAYOUT_CHILDREN;
    }
  }

  markDirtyClipping() {
    this.flags |= Flags.NODE_HAS_DIRTY_CLIPPING;

    for (let parent = this.parentNode; parent; parent = parent.parentNode) {
      if (parent.flags & Flags.NODE_HAS_DIRTY_CLIPPING_CHILDREN)
        break;
      parent.flags |= Flags.NODE_HAS_DIRTY_CLIPPING_CHILDREN;
    }
  }

  markDirtyRender() {
    this.flags |= Flags.NODE_HAS_DIRTY_RENDER;

    for (let parent = this.parentNode; parent; parent = parent.parentNode) {
      if (parent.flags & Flags.NODE_HAS_DIRTY_RENDER_CHILDREN)
        break;
      parent.flags |= Flags.NODE_HAS_DIRTY_RENDER_CHILDREN;
    }
  }

  applyTextStyle(text: string, { backColor = this.style.get(`contentBackColor`) || this.style.get(`backgroundBackColor`), frontColor = this.style.get(`contentFrontColor`) }: {backColor?: string, frontColor?: string} = {}) {
    const backColorEntry = backColor
      ? getColorEntry(backColor)
      : null;

    if (backColorEntry)
      text = backColorEntry.back.in + text + backColorEntry.back.out;

    const frontColorEntry = frontColor
      ? getColorEntry(frontColor)
      : null;

    if (frontColorEntry)
      text = frontColorEntry.front.in + text + frontColorEntry.front.out;

    return text;
  }

  propagateLayout(dirtyRects: DirtyScreen) {
    if (this.parentNode)
      throw new Error(`Assertion failed: Cannot call propagateLayout from a non-tree node`);

    this.yoga.calculateLayout();

    //console.group(`layout`);
    this.cascadeLayout(dirtyRects, false);
    //console.groupEnd();

    //console.group(`clipping`);
    this.cascadeClipping(dirtyRects, false, null);
    //console.groupEnd();

    //console.group(`rendering`);
    this.cascadeRendering(dirtyRects, false);
    //console.groupEnd();
  }

  private cascadeLayout(dirtyScreen: DirtyScreen, force: boolean) {
    //console.group();

    if (force || this.flags & (Flags.NODE_HAS_DIRTY_LAYOUT | Flags.NODE_HAS_DIRTY_LAYOUT_CHILDREN)) {
      let doesLayoutChange = false;
      let doesScrollChange = false;

      if (force || this.flags & Flags.NODE_HAS_DIRTY_LAYOUT_CHILDREN) {
        const layout = this.yoga.getComputedLayout();

        this.elementRect.left = layout.left;
        this.elementRect.top = layout.top;

        this.elementRect.width = layout.width;
        this.elementRect.height = layout.height;

        doesLayoutChange = this.trackChanges(`layout`, [
          this.elementRect.left,
          this.elementRect.top,
          this.elementRect.width,
          this.elementRect.height,
        ]);
      }

      if (this.flags & (Flags.NODE_HAS_DIRTY_LAYOUT | Flags.NODE_HAS_DIRTY_LAYOUT_CHILDREN) || doesLayoutChange) {
        for (const child of this.childNodes)
          child.cascadeLayout(dirtyScreen, true);

        const prevScrollWidth = this.scrollRect.width;
        const prevScrollHeight = this.scrollRect.height;

        const preferredScrollSize = this.getPreferredScrollSize();

        this.scrollRect.width = Math.max(this.elementRect.width, preferredScrollSize.width);
        this.scrollRect.height = Math.max(this.elementRect.height, preferredScrollSize.height);

        for (const child of this.childNodes) {
          this.scrollRect.width = Math.max(this.scrollRect.width, child.elementRect.left + child.elementRect.width);
          this.scrollRect.height = Math.max(this.scrollRect.height, child.elementRect.top + child.elementRect.height);
        }

        this.contentRect.left = 0;//this.yoga.getComputedBorder(this.env.yoga.EDGE_LEFT) + this.yoga.getComputedPadding(this.env.yoga.EDGE_LEFT);
        this.contentRect.top = 0;//this.yoga.getComputedBorder(this.env.yoga.EDGE_TOP) + this.yoga.getComputedPadding(this.env.yoga.EDGE_TOP);

        this.contentRect.width = this.scrollRect.width;// - this.contentRect.left - this.yoga.getComputedBorder(this.env.yoga.EDGE_RIGHT) - this.yoga.getComputedPadding(this.env.yoga.EDGE_RIGHT);
        this.contentRect.height = this.scrollRect.height;// - this.contentRect.top - this.yoga.getComputedBorder(this.env.yoga.EDGE_BOTTOM) - this.yoga.getComputedPadding(this.env.yoga.EDGE_BOTTOM);

        doesScrollChange = this.trackChanges(`scroll`, [
          this.scrollRect.width,
          this.scrollRect.height,

          this.contentRect.left,
          this.contentRect.top,
          this.contentRect.width,
          this.contentRect.height,
        ]);
      }

      if (doesLayoutChange || doesScrollChange)
        this.markDirtyClipping();

      this.flags &= ~(
        Flags.NODE_HAS_DIRTY_LAYOUT |
        Flags.NODE_HAS_DIRTY_LAYOUT_CHILDREN
      );
    }

    //console.groupEnd();
  }

  private cascadeClipping(dirtyScreen: DirtyScreen, force: boolean, relativeClipRect: Rect | null) {
    //console.group();

    force = this.trackChanges(`relativeClipRect`, [
      relativeClipRect,
    ]) || force;

    if (force || this.flags & (Flags.NODE_HAS_DIRTY_CLIPPING | Flags.NODE_HAS_DIRTY_CLIPPING_CHILDREN)) {
      if (force || this.flags & Flags.NODE_HAS_DIRTY_CLIPPING) {
        this.scrollRect.left = Math.min(this.scrollRect.left, this.scrollRect.width - this.elementRect.width);
        this.scrollRect.top = Math.min(this.scrollRect.top, this.scrollRect.height - this.elementRect.height);

        const parentScrollLeft = this.parentNode ? this.parentNode.scrollRect.left : 0;
        const parentScrollTop = this.parentNode ? this.parentNode.scrollRect.top : 0;

        this.elementWorldRect.left = this.parentNode ? this.parentNode.elementWorldRect.left + this.elementRect.left - parentScrollLeft : 0;
        this.elementWorldRect.top = this.parentNode ? this.parentNode.elementWorldRect.top + this.elementRect.top - parentScrollTop : 0;

        this.elementWorldRect.width = this.elementRect.width;
        this.elementWorldRect.height = this.elementRect.height;

        this.contentWorldRect.left = this.elementWorldRect.left + this.contentRect.left;
        this.contentWorldRect.top = this.elementWorldRect.top + this.contentRect.top;

        this.contentWorldRect.width = this.contentRect.width;
        this.contentWorldRect.height = this.contentRect.height;

        const prevElementClipLeft = this.elementClipRect.left;
        const prevElementClipTop = this.elementClipRect.top;
        const prevElementClipWidth = this.elementClipRect.width;
        const prevElementClipHeight = this.elementClipRect.height;

        if (relativeClipRect) {
          computeInPlaceIntersectingRect(this.elementClipRect, this.elementWorldRect, relativeClipRect);
          computeInPlaceIntersectingRect(this.contentClipRect, this.contentWorldRect, relativeClipRect);
        } else {
          this.elementClipRect.left = this.elementWorldRect.left;
          this.elementClipRect.top = this.elementWorldRect.top;

          this.elementClipRect.width = this.elementWorldRect.width;
          this.elementClipRect.height = this.elementWorldRect.height;

          this.contentClipRect.left = this.contentWorldRect.left;
          this.contentClipRect.top = this.contentWorldRect.top;

          this.contentClipRect.width = this.contentWorldRect.width;
          this.contentClipRect.height = this.contentWorldRect.height;
        }

        const doesClippingChange = this.trackChanges(`clipping`, [
          this.elementWorldRect.left,
          this.elementWorldRect.top,
          this.elementWorldRect.width,
          this.elementWorldRect.height,

          this.contentWorldRect.left,
          this.contentWorldRect.top,
          this.contentWorldRect.width,
          this.contentWorldRect.height,

          this.elementClipRect.left,
          this.elementClipRect.top,
          this.elementClipRect.width,
          this.elementClipRect.height,

          this.contentClipRect.left,
          this.contentClipRect.top,
          this.contentClipRect.width,
          this.contentClipRect.height,
        ]);

        if (doesClippingChange) {
          // If the clipping changes, we must redraw the previous location where the node was, since it doesn't cover it anymore
          dirtyScreen.addCoordinates(prevElementClipLeft, prevElementClipTop, prevElementClipWidth, prevElementClipHeight);

          // We also have to redraw the new location where the node can be found, which be batch as a rendering (so that we don't perform the calculations twice if the node is dirty clipping + dirty rendering)
          this.markDirtyRender();
        }
      }

      if (!relativeClipRect)
        relativeClipRect = this.elementClipRect;

      for (const child of this.childNodes)
        child.cascadeClipping(dirtyScreen, force, relativeClipRect);

      this.flags &= ~(
        Flags.NODE_HAS_DIRTY_CLIPPING |
        Flags.NODE_HAS_DIRTY_CLIPPING_CHILDREN
      );
    }

    //console.groupEnd();
  }

  private cascadeRendering(dirtyScreen: DirtyScreen, force: boolean) {
    //console.group();

    if (force || this.flags & (Flags.NODE_HAS_DIRTY_RENDER | Flags.NODE_HAS_DIRTY_RENDER_CHILDREN)) {
      if (force || (this.flags & Flags.NODE_HAS_DIRTY_RENDER))
        dirtyScreen.addRect(this.elementClipRect);

      for (const child of this.childNodes)
        child.cascadeRendering(dirtyScreen, force || Boolean(this.flags & Flags.NODE_HAS_DIRTY_RENDER));

      this.flags &= ~(
        Flags.NODE_HAS_DIRTY_RENDER |
        Flags.NODE_HAS_DIRTY_RENDER_CHILDREN
      );
    }

    //console.groupEnd();
  }

  private trackChanges(trackerName: string, data: Array<any>) {
    const previous = this.trackers.get(trackerName);
    this.trackers.set(trackerName, data);

    if (!previous)
      return true;

    if (previous.length !== data.length)
      return true;

    for (let t = 0; t < data.length; ++t)
      if (data[t] !== previous[t])
        return true;

    return false;
  }

  private linkRecursive() {
    if (!this.parentNode || !this.parentNode.rootNode)
      throw new Error(`Assertion failed: linkRecursive called on a node that hasn't been correctly setup`);

    if (this.rootNode)
      throw new Error(`Assertion failed: linkRecursive called on a node that's already been linked`);

    this.rootNode = this.parentNode.rootNode;
    this.linkSelf(this.rootNode, this.parentNode);

    for (const child of this.childNodes) {
      child.linkRecursive();
    }
  }

  private unlinkRecursive() {
    if (!this.rootNode || !this.parentNode)
      throw new Error(`Assertion failed: unlinkRecursive called on a node that hasn't been correctly setup`);

    for (const child of this.childNodes)
      child.unlinkRecursive();

    this.unlinkSelf(this.rootNode, this.parentNode);
    this.rootNode = null;
  }

  abstract linkSelf(rootNode: Node, parentNode: Node): void;
  abstract unlinkSelf(rootNode: Node, parentNode: Node): void;

  abstract dumpNode(depth?: number): void;

  abstract getLine(y: number, left: number, width: number): string;
}
