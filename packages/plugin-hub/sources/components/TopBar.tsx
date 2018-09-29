import React = require('react');

import {Div} from '@berry/ui';

type TopBarProps = {
  widgets: Array<() => string>,
};

const topBarStyle = {
  flexDirection: `row`,

  width: `100%`,
  height: 1,

  backgroundBackColor: `#2188b6`,
  contentFrontColor: `#ffffff`,
};

const topBarWidgetStyle = {
  marginLeft: 1,
  marginRight: 1,
};

const topBarSeparatorStyle = {
  contentFrontColor: `#eeeeee`,
};

const TopBarWidget = ({children}: {children: any}) => <Div style={topBarWidgetStyle}>
  {children}
</Div>;

const TopBarSeparator = () => <Div style={topBarSeparatorStyle}>
  |
</Div>;

export class TopBar extends React.Component<TopBarProps, any> {
  private updateTimer: any;

  componentDidMount() {
    this.updateTimer = setInterval(() => {
      this.forceUpdate();
    }, 1000);
  }

  componentWillUnmount() {
    clearInterval(this.updateTimer);
  }

  render = () => <Div style={topBarStyle}>
    {this.renderWidgets()}
  </Div>;

  private renderWidgets() {
    const components = [];

    for (const widget of this.props.widgets) {
      if (components.length > 0)
        components.push(<TopBarSeparator key={(components.length - 1) / 2} />);

      components.push(<TopBarWidget>
        {widget()}
      </TopBarWidget>);
    }

    return components;
  }
}
