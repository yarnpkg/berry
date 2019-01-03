import React         from 'react';

import {NodeElement} from './NodeElement';

export enum StylePositionEnum {
  Absolute = 'absolute',
}

export enum StyleFlexDirectionEnum {
  Column = 'column',
  Row = 'row',
}

export type StyleProp = Partial<{
  position: StylePositionEnum,

  left: number | string,
  right: number | string,
  top: number | string,
  bottom: number | string,

  flexDirection: StyleFlexDirectionEnum,
  flexGrow: number,
  flexShrink: number,
  flex: number,

  marginLeft: number | string,
  marginRight: number | string,
  marginTop: number | string,
  marginBottom: number | string,

  minWidth: number | string,
  minHeight: number | string,

  maxWidth: number | string,
  maxHeight: number | string,

  width: number | string,
  height: number | string,

  paddingLeft: number | string,
  paddingRight: number | string,
  paddingTop: number | string,
  paddingBottom: number | string,

  backgroundColor: string,

  backgroundBackColor: string,
  backgroundFrontColor: string,

  borderBackColor: string,
  borderFrontColor: string,

  contentFrontColor: string,
  contentBackColor: string,
}>;

export type ShortcutProp = {
  [sequence: string]: (e: any) => void | null,
};

export type DivProps = {
  caret?: {x: number, y: number} | null,
  globalShortcuts?: ShortcutProp,
  renderFn?: ((row: number, left: number, width: number, renderText: (text: string) => string, renderBackground: (width: number) => string) => string) | null,
  style?: StyleProp,
  shortcuts?: ShortcutProp,
  tabIndex?: number | null,

  onBlur?: ((event: any) => void) | null,
  onFocus?: ((event: any) => void) | null,

  onData?: ((event: any) => void) | null,

  onWheel?: ((event: any) => void) | null,
  onShortcut?: ((event: any) => void) | null,

  onResize?: ((event: any) => void) | null,
};

export class Div extends React.Component<DivProps, any> {
  private mainRef: NodeElement | null = null;

  markDirtyRender() {
    if (!this.mainRef)
      return;
    
    this.mainRef.markDirtyRender();
  }

  triggerFocus() {
    if (!this.mainRef)
      return;
    
    if (!this.mainRef.rootNode)
      throw new Error(`Assertion failed: This element should belong to a tree`);

    this.mainRef.rootNode.focus(this.mainRef);
  }

  private handleRef = (node: NodeElement | null) => {
    this.mainRef = node;
  };

  render() {
    return React.createElement(`div`, {ref: this.handleRef, ... this.props});
  }
};
