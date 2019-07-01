import React, {Component} from 'react';
import {SearchBox}        from 'react-instantsearch-dom';

class WrappedSearchBox extends Component {
  state = { active: false };

  handleFocus = () =>
    this.setState({
      active: true,
    });

  handleBlur = () =>
    this.setState({
      active: false,
    });

  render() {
    return (
      <div className={this.state.active ? 'active' : ''}>
        <SearchBox
          onFocus={this.handleFocus}
          onBlur={this.handleBlur}
          {...this.props}
        />
      </div>
    );
  }
}

export default WrappedSearchBox;
