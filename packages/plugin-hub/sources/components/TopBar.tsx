import React = require('react');

import {Div, StyleFlexDirectionEnum} from '@berry/ui';

type TopBarProps = {
  widgets: Array<() => string>,
};

const topBarStyle = {
  flexDirection: StyleFlexDirectionEnum.Row,

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
    const components = this.props.widgets.map((widget, t) => <TopBarWidget key={`widget-${t}`}>
      {widget()}
    </TopBarWidget>);

    for (let t = 0, T = components.length - 1; t < T; ++t)
      components.splice(1 + t * 2, 0, <TopBarSeparator key={`sep-${t}`} />);

    return components;
  }
}
