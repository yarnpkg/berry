import {TextLayout}     from '@manaflair/text-layout';

import {Environment}    from './Environment';
import {NodeTree}       from './NodeTree';
import {Node, NodeType} from './Node';

export class NodeText extends Node {
  public textContent: string = ``;

  private readonly textLayout: TextLayout;

  constructor(env: Environment, textContent: string) {
    super(env, NodeType.TEXT);

    this.textContent = textContent;

    this.textLayout = new this.env.textLayout.TextLayout();
    this.textLayout.setSoftWrap(true);

    this.yoga.setMeasureFunc((widthHint: number, widthMode: any, heightHint: number, heightMode: any) => {
      if (this.textLayout.setColumns(widthHint))
        this.textLayout.clearSource();

      const width = this.textLayout.getColumnCount();
      const height = this.textLayout.getRowCount();

      return {width, height};
    });
  }

  linkSelf(rootNode: NodeTree, parentNode: Node) {
    if (!(this.previousSibling instanceof NodeText)) {
      this.activate();

      for (let node = this.nextSibling; node instanceof NodeText; node = node.nextSibling) {
        node.deactivate();
      }
    } else {
      this.deactivate();

      let leftMostTextNode = this.previousSibling;

      while (leftMostTextNode.previousSibling instanceof NodeText)
        leftMostTextNode = leftMostTextNode.previousSibling;
      
      leftMostTextNode.clearTextLayout();
    }
  }

  unlinkSelf(rootNode: NodeTree, parentNode: Node) {
    if (!(this.previousSibling instanceof NodeText)) {
      this.deactivate();

      if (this.nextSibling instanceof NodeText) {
        this.nextSibling.activate();
      }
    } else {
      this.activate();
      
      let leftMostTextNode = this.previousSibling;

      while (leftMostTextNode.previousSibling instanceof NodeText)
        leftMostTextNode = leftMostTextNode.previousSibling;
      
      leftMostTextNode.clearTextLayout();
    }
  }

  setTextContent(content: string) {
    this.textContent = content;

    let activeTextNode: NodeText = this;

    while (activeTextNode.previousSibling instanceof NodeText)
      activeTextNode = activeTextNode.previousSibling;

    activeTextNode.clearTextLayout();
  }

  clearTextLayout() {
    let fullContent = ``;
    let textNode: Node | null = this;

    while (textNode instanceof NodeText) {
      fullContent += textNode.textContent;
      textNode = textNode.nextSibling;
    }

    this.textLayout.setSource(fullContent);
    this.yoga.markDirty();

    this.markDirtyLayout();
    this.markDirtyRender();
  }

  dumpNode(depth: number = 0) {
    const indent = `  `.repeat(depth);

    console.log(indent + `{... text node ...}`);
  }

  getLine(y: number, left: number, width: number) {
    const background = this.style.get(`background`);

    const line = this.textLayout.getLine(y).substr(left, width);
    const pad = background.repeat(Math.ceil((width - line.length) / background.length)).substr(0, width - line.length);

    const formattedLine = this.applyTextStyle(line);
    const formattedPad = pad ? this.applyTextStyle(pad, {backColor: this.style.get(`backgroundBackColor`), frontColor: this.style.get(`backgroundFrontColor`)}) : ``;

    return formattedLine + formattedPad;
  }

  private activate() {
    this.yoga.display = this.env.yoga.Constants.display.flex;

    this.clearTextLayout();
  }

  private deactivate() {
    this.yoga.display = this.env.yoga.Constants.display.none;
  }
}
