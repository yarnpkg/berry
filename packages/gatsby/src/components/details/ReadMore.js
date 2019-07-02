import React from 'react';

class ReadMore extends React.Component {
  constructor(props) {
    super(props);

    this.maxHeight = `${props.height}px`;
    this.state = {
      collapsed: true,
      collapsible: true,
    };
  }

  toggleCollapse = () => {
    this.setState({
      collapsed: !this.state.collapsed,
    });
  };

  componentWillUpdate(nextProps, nextState) {
    const { height } = this.content.getBoundingClientRect();
    if (nextState.collapsible && height < nextProps.height) {
      this.setState({
        collapsible: false,
        collapsed: false,
      });
    }
  }

  render() {
    const { children, text, className } = this.props;
    const { collapsed, collapsible } = this.state;

    return (
      <div
        className={`${className} readMore ${
          collapsed ? 'readMore--collapsed' : ''
        }`}
      >
        <div
          className="readMore--content"
          style={{ maxHeight: collapsed ? this.maxHeight : '' }}
          ref={div => (this.content = div)}
        >
          {children}
        </div>
        {collapsible && (
          <button className="readMore--button" onClick={this.toggleCollapse}>
            {collapsed ? text : 'Collapse'}
            <img
              src="/assets/detail/ico-readmore.svg"
              alt=""
              className="readMore--icon"
              style={{ transform: collapsed ? '' : 'rotate(180deg)' }}
            />
          </button>
        )}
      </div>
    );
  }
}

ReadMore.defaultProps = {
  height: 250,
  className: '',
};

export default ReadMore;
