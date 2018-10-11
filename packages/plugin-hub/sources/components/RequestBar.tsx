import React = require('react');

import {Input}                       from '@berry/ui/sources/widgets/Input';
import {Div, StyleFlexDirectionEnum} from '@berry/ui';

const requestBarStyle = {
  flexDirection: StyleFlexDirectionEnum.Row,

  width: `100%`,
  height: 1,

  backgroundBackColor: `yellow`,

  contentFrontColor: `#000000`,
};

const labelStyle = {
  marginLeft: 1,
  marginRight: 1,
};

const inputStyle = {
  flex: 1,

  backgroundBackColor: `inherit`,

  backgroundFrontColor: `#000000`,
  contentFrontColor: `#000000`,
};

export type RequestBarProps = {
  initialValue: string,
  label: string,

  onChange: (value: string) => void,
  onCommit: (value: string) => void,
  onRollback: (value: string) => void,
};

export type RequestBarState = {
  initialValue: string,
  value: string,
};

export class RequestBar extends React.PureComponent<RequestBarProps, RequestBarState> {
  constructor(props: RequestBarProps) {
    super(props);

    this.state = {
      initialValue: props.initialValue,
      value: props.initialValue,
    };
  }

  handleChange = (value: string) => {
    this.setState({value});
    this.props.onChange(value);
  };

  handleEnterKey = () => {
    this.props.onCommit(this.state.value);
  };

  handleEscapeKey = () => {
    this.props.onRollback(this.state.initialValue);
  };

  render = () => <Div style={requestBarStyle}>
    <Div style={labelStyle}>{this.props.label}:</Div>
    <Input style={inputStyle} autofocus={true} monoline={true} defaultValue={this.state.initialValue} onChange={this.props.onChange} onEnterKey={this.handleEnterKey} onEscapeKey={this.handleEscapeKey} />
  </Div>;
}
