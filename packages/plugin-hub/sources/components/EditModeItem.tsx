import React = require('react');

import {Input}                                     from '@berry/ui/sources/widgets/Input';
import {Div, ShortcutProp, StyleFlexDirectionEnum} from '@berry/ui';

const mainStyle = {
};

const mainFocusedStyle = {
  ... mainStyle,

  backgroundBackColor: `#2188b6`,

  contentFrontColor: `#ffffff`,
};

const mainEditedStyle = {
  ... mainStyle,

  backgroundBackColor: `orange`,

  contentFrontColor: `#ffffff`,
};

const editModeStyle = {
  flexDirection: StyleFlexDirectionEnum.Row,
};

const textModeStyle = {
  flexDirection: StyleFlexDirectionEnum.Column,
};

const inputStyle = {
  flexGrow: 1,

  backgroundBackColor: `orange`,

  contentFrontColor: `#ffffff`,
};

export type EditModeItemProps = {
  editLabel?: string,
  editInitialValue?: string,
  shortcuts?: ShortcutProp,

  children: any,

  onBlur?: (() => void) | null,
  onFocus?: (() => void) | null,
};

export type EditModeItemState = {
  focused: boolean,
  edited: boolean,
};

export class EditModeItem extends React.PureComponent<EditModeItemProps, EditModeItemState> {
  mainRef = React.createRef<Div>();

  state = {
    focused: false,
    edited: false,
  };

  triggerFocus() {
    if (this.mainRef.current) {
      // @ts-ignore
      this.mainRef.current.triggerFocus();
    }
  }

  private handleFocus = () => {
    this.setState({focused: true});

    if (this.props.onFocus) {
      this.props.onFocus();
    }
  };

  private handleBlur = () => {
    this.setState({focused: false});

    if (this.props.onBlur) {
      this.props.onBlur();
    }
  };

  private handleStartEdit = (e: any) => {
    if (this.state.edited)
      return;

    e.preventDefault();

    this.setState({edited: true});
  };

  private handleRollbackEdit = () => {
    if (!this.state.edited)
      return;

    this.setState({edited: false});
    this.triggerFocus();
  };

  private handleConfirmEdit = () => {
    if (!this.state.edited)
      return;

    this.setState({edited: false});
    this.triggerFocus();
  };

  private shortcuts = {
    [`e`]: this.handleStartEdit,
  };

  renderEditMode = () => <Div style={editModeStyle}>
    {this.props.editLabel && <div>{this.props.editLabel}</div>}
    <Input style={inputStyle} autofocus={true} monoline={true} onBlur={this.handleRollbackEdit} onEnterKey={this.handleConfirmEdit} onEscapeKey={this.handleRollbackEdit} defaultValue={this.props.editInitialValue} />
  </Div>;

  renderTextMode = () => <Div style={textModeStyle}>
    {this.props.children}
  </Div>;

  render = () => {
    const style = this.state.edited
      ? mainEditedStyle
      : this.state.focused
        ? mainFocusedStyle
        : mainStyle;
    
    return <Div ref={this.mainRef} tabIndex={0} onFocus={this.handleFocus} onBlur={this.handleBlur} style={style} shortcuts={{... this.shortcuts, ... this.props.shortcuts}}>
      {this.state.edited ? this.renderEditMode() : this.renderTextMode()}
    </Div>;
  }
}
