import React = require('react');
import tlPromise = require('@manaflair/text-layout');

import {TextLayout, TextLayoutStruct} from '@manaflair/text-layout';

import {Div, StyleProp}               from '../Div';

import {uncontrollable}               from './uncontrollable';

const commonStyle = {
  background: `.`,
  backgroundBackColor: `black`,
  backgroundFrontColor: `grey`,
};

const regularStyle = {
  ... commonStyle,

  backgroundFrontColor: `grey`,
  contentFrontColor: `grey`,

  whiteSpace: `noWrap`,
};

const focusedStyle = {
  ... commonStyle,

  backgroundFrontColor: `white`,
  contentFrontColor: `white`,
};

const placeholderStyle = {
  contentFrontColor: regularStyle.backgroundFrontColor,
};

type InputProps = {
  autofocus?: boolean,
  monoline?: boolean,

  placeholder?: string,
  defaultValue?: string,
  value?: string,

  style?: StyleProp,

  onChange?: (value: string) => void,

  onBlur?: (() => void) | null,
  onFocus?: (() => void) | null,

  onBackspaceKey?: (() => void) | null,
  onEnterKey?: (() => void) | null,
  onEscapeKey?: (() => void) | null,
  onDeleteKey?: (() => void) | null,

  onLeftKey?: (() => void) | null,
  onRightKey?: (() => void) | null,
  onUpKey?: (() => void) | null,
  onDownKey?: (() => void) | null,
};

export const Input = uncontrollable<string, InputProps>(``)(class Input extends React.Component<InputProps & {value: string}, any> {
  state = {
    textLayout: null,

    focused: false,

    textCaretX: 0,
    textCaretY: 0,

    scrollTop: 0,
    scrollLeft: 0,

    contentWidth: 0,
    contentHeight: 0,
  };

  private textBuffer: TextLayout | null = null;
  private readonly textBufferPromise: Promise<void>;

  private textCaret: {x: number, y: number} = {x: 0, y: 0};
  private textCaretPreferredColumn: number = 0;

  private mainRef: React.RefObject<Div> = React.createRef();
  private inputRef: React.RefObject<Div> = React.createRef();

  constructor(props: any) {
    super(props);

    this.textBufferPromise = tlPromise.then(({TextLayout}: TextLayoutStruct) => {
      this.textBuffer = new TextLayout();

      this.textBuffer.setPreserveLeadingSpaces(true);
      this.textBuffer.setPreserveTrailingSpaces(true);

      this.textBuffer.setSource(this.props.value);

      if (this.inputRef.current)
        this.inputRef.current.markDirtyRender();

      this.textCaret = this.textBuffer.getLastPosition();
      this.textCaretPreferredColumn = this.textCaret.x;

      this.setState({
        textLayout: this.textBuffer,

        textCaretX: this.textCaret.x,
        textCaretY: this.textCaret.y,
      });
    });
  }

  triggerFocus() {
    if (this.props.autofocus && this.mainRef.current) {
      this.mainRef.current.triggerFocus();
    }
  }

  private handleResize = (e: any) => {
    const contentWidth = e.contentSize.width;
    const contentHeight = e.contentSize.height;

    this.setState({
      contentWidth,
      contentHeight,
    });
  };

  private handleFocus = (e: any) => {
    this.setState({
      focused: true,
    });

    if (this.props.onFocus) {
      this.props.onFocus();
    }
  };

  private handleBlur = (e: any) => {

    this.setState({
      focused: false,
    });

    if (this.props.onBlur) {
      this.props.onBlur();
    }
  };

  private handleEnterKey = (e: any) => {
    if (!this.props.onChange)
      return;
    
    e.stopPropagation();

    if (!this.textBuffer)
      return;

    if (!this.props.monoline) {
      const characterIndex = this.textBuffer.getCharacterIndexForPosition(this.textCaret);

      this.textBuffer.spliceSource(characterIndex, 0, `\n`);

      if (this.inputRef.current)
        this.inputRef.current.markDirtyRender();

      this.textCaret = this.textBuffer.getPositionForCharacterIndex(characterIndex + 1);
      this.textCaretPreferredColumn = this.textCaret.x;

      this.setState({
        textCaretX: this.textCaret.x,
        textCaretY: this.textCaret.y,
      });

      this.props.onChange(
        this.textBuffer.getSource(),
      );
    }

    if (this.props.onEnterKey) {
      this.props.onEnterKey();
    }
  };

  private handleBackspaceKey = (e: any) => {
    if (!this.props.onChange)
      return;
    
    e.stopPropagation();
    
    if (!this.textBuffer)
      return;

    const characterIndex = this.textBuffer.getCharacterIndexForPosition(this.textCaret);

    if (characterIndex === 0)
      return;
    
    this.textBuffer.spliceSource(characterIndex - 1, 1, ``);

    if (this.inputRef.current)
      this.inputRef.current.markDirtyRender();

    this.textCaret = this.textBuffer.getPositionForCharacterIndex(characterIndex - 1);
    this.textCaretPreferredColumn = this.textCaret.x;

    this.setState({
      textCaretX: this.textCaret.x,
      textCaretY: this.textCaret.y,
    });

    this.props.onChange(
      this.textBuffer.getSource(),
    );

    if (this.props.onBackspaceKey) {
      this.props.onBackspaceKey();
    }
  };

  private handleDeleteKey = (e: any) => {
    if (!this.props.onChange)
      return;
    
    e.stopPropagation();
    
    if (!this.textBuffer)
      return;

    const characterIndex = this.textBuffer.getCharacterIndexForPosition(this.textCaret);

    if (characterIndex === this.textBuffer.getMaxCharacterIndex())
      return;
    
    this.textBuffer.spliceSource(characterIndex, 1, ``);

    if (this.inputRef.current)
      this.inputRef.current.markDirtyRender();

    this.props.onChange(
      this.textBuffer.getSource(),
    );

    if (this.props.onDeleteKey) {
      this.props.onDeleteKey();
    }
  };

  private handleEscapeKey = (e: any) => {
    e.stopPropagation();

    if (this.props.onEscapeKey) {
      this.props.onEscapeKey();
    }
  };

  private handleData = (e: any) => {
    if (!this.props.onChange)
      return;

    const dataString = e.buffer.toString();

    if (!this.textBuffer)
      return;

    const characterIndex = this.textBuffer.getCharacterIndexForPosition(this.textCaret);

    this.textBuffer.spliceSource(characterIndex, 0, dataString);

    this.textCaret = this.textBuffer.getPositionForCharacterIndex(characterIndex + dataString.length)
    this.textCaretPreferredColumn = this.textCaret.x;

    if (this.inputRef.current)
      this.inputRef.current.markDirtyRender();

    this.setState({
      textCaretX: this.textCaret.x,
      textCaretY: this.textCaret.y,
    });

    this.props.onChange(
      this.textBuffer.getSource(),
    );
  };

  private handleUpKey = (e: any) => {
    e.stopPropagation();

    if (!this.textBuffer)
      return;

    const [position, perfectFit] = this.textBuffer.getPositionAbove({x: this.textCaretPreferredColumn, y: this.textCaret.y});

    this.textCaret = position;
    
    if (perfectFit)
      this.textCaretPreferredColumn = this.textCaret.x;
  
    this.setState({
      textCaretX: this.textCaret.x,
      textCaretY: this.textCaret.y,
    });
  };

  private handleDownKey = (e: any) => {
    e.stopPropagation();

    if (!this.textBuffer)
      return;

    const [position, perfectFit] = this.textBuffer.getPositionBelow({x: this.textCaretPreferredColumn, y: this.textCaret.y});

    this.textCaret = position;
    
    if (perfectFit)
      this.textCaretPreferredColumn = this.textCaret.x;
  
    this.setState({
      textCaretX: this.textCaret.x,
      textCaretY: this.textCaret.y,
    });
  };

  private handleLeftKey = (e: any) => {
    e.stopPropagation();

    if (!this.textBuffer)
      return;
    
    const [position, perfectFit] = this.textBuffer.getPositionLeft({x: this.textCaretPreferredColumn, y: this.textCaret.y});

    this.textCaret = position;
    
    if (perfectFit)
      this.textCaretPreferredColumn = this.textCaret.x;

    this.setState({
      textCaretX: this.textCaret.x,
      textCaretY: this.textCaret.y,
    });
  };

  private handleRightKey = (e: any) => {
    e.stopPropagation();

    if (!this.textBuffer)
      return;

    const [position, perfectFit] = this.textBuffer.getPositionRight({x: this.textCaretPreferredColumn, y: this.textCaret.y});

    this.textCaret = position;
    
    if (perfectFit)
      this.textCaretPreferredColumn = this.textCaret.x;
  
    this.setState({
      textCaretX: this.textCaret.x,
      textCaretY: this.textCaret.y,
    })
  };

  private handleWheel = (e: any) => {
    this.setState(({scrollTop, scrollLeft}: {scrollTop: number, scrollLeft: number}) => {
      scrollLeft = Math.max(0, Math.min(scrollLeft, this.state.contentWidth));
      scrollTop = Math.max(0, Math.min(scrollTop, this.state.contentHeight + e.mouse.d));
  
      return {scrollLeft, scrollTop};
    });
  };

  private renderContentText = (row: number, left: number, width: number, renderText: (text: string) => string, renderBackground: (size: number) => string) => {
    // Factor the scroll to find out the actual line we need to render
    row -= this.state.scrollTop;

    const line = this.textBuffer && row >= 0 && row < this.textBuffer.getRowCount() ? this.textBuffer.getLine(row) : ``;
    const slice = line.substr(left, width);

    return renderText(slice) + renderBackground(width - slice.length);
  };

  shortcuts = {
    enter: this.handleEnterKey,
    backspace: this.handleBackspaceKey,
    delete: this.handleDeleteKey,
    escape: this.handleEscapeKey,

    up: this.handleUpKey,
    right: this.handleRightKey,
    down: this.handleDownKey,
    left: this.handleLeftKey,
  };

  componentDidMount() {
    this.triggerFocus();
  }

  render() {
    if (this.textBuffer) {
      if (this.props.value !== this.textBuffer.getSource()) {
        this.textBuffer.setSource(this.props.value);
        this.textCaret = this.textBuffer.getFixedPosition(this.textCaret);
      }
    }

    const baseStyle = this.state.focused
      ? focusedStyle
      : regularStyle;

    const lineHeight = this.textBuffer
      ? this.textBuffer.getRowCount()
      : 0;

    return <Div ref={this.mainRef} style={{... baseStyle, ... this.props.style}} tabIndex={0} caret={{x: this.state.textCaretX, y: this.state.textCaretY}} onResize={this.handleResize} onFocus={this.handleFocus} onBlur={this.handleBlur} onData={this.handleData} onWheel={this.handleWheel} shortcuts={this.shortcuts}>
      {this.props.value ? <Div ref={this.inputRef} style={{height: lineHeight, minHeight: 1}} renderFn={this.renderContentText} /> : <Div style={placeholderStyle}>
        {this.props.placeholder}
      </Div>}
    </Div>;
  }

});
