import React = require('react');

export function uncontrollable<T, ClassProps>(defaultValue: T) {
  type Props = {value?: T, defaultValue?: T, onChange?: (value: T) => void} & ClassProps;
  type State = {value: T};

  return (Class: typeof React.Component) => {
    return class extends React.Component<Props, State> {
      constructor(props: any) {
        super(props);

        this.state = {
          value: props.value !== undefined ? props.value : props.defaultValue || defaultValue,
        };
      }

      static getDerivedStateFromProps(props: any, state: any) {
        return {value: props.value !== undefined ? props.value : state.value};
      }

      handleChange = (value: T) => {
        this.setState({value});

        if (this.props.onChange) {
          this.props.onChange(value);
        }
      }

      render() {
        return <Class {... this.props} value={this.state.value} onChange={this.handleChange} />;
      }
    };
  };
}
