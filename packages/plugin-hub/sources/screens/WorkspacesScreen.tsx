import React = require('react');

import {Project}                             from '@berry/core';
import {iterate}                             from '@berry/ui/sources/tools';
import {Div}                                 from '@berry/ui';
import {connect}                             from 'react-redux';

import {WorkspaceView}                       from './workspaces/WorkspaceView';

import {RequestBar}                          from '../components/RequestBar';
import {TopBar}                              from '../components/TopBar';
import {Hostname, Time, ProjectName, Widget} from '../components/Widget';

export type WorkspacesScreenProps = {
  project: Project,
};

export type WorkspacesScreenState = {
  filterMode: boolean,
  filterRegexp: RegExp | null,
  filter: string,
  widgets: Array<Widget>,
};

class WorkspacesScreen extends React.PureComponent<WorkspacesScreenProps, WorkspacesScreenState> {
  state = {
    filterMode: false,
    filterRegexp: null,
    filter: ``,
    widgets: [],
  };

  static getDerivedStateFromProps(props: WorkspacesScreenProps, state: WorkspacesScreenState): Partial<WorkspacesScreenState> {
    return {
      widgets: [
        Hostname,
        Time,
        ProjectName(props.project),
      ],
    };
  }

  handleFilterModeEnter = () => {
    this.setState({filterMode: true});
  };

  handleFilterRollback = (filter: string) => {
    const filterRegexp = filter ? new RegExp(filter) : null;

    this.setState({filterMode: false, filter, filterRegexp});
  };

  handleFilterCommit = () => {
    this.setState({filterMode: false});
  };

  handleFilterChange = (filter: string) => {
    this.setState(({filterRegexp}) => {
      try {
        filterRegexp = filter ? new RegExp(filter) : null;
      } catch (error) {
        // Ignore invalid regexps
      }      
      return {filter, filterRegexp};
    });
  };

  globalShortcuts = {
    [`ctrl-f`]: this.handleFilterModeEnter,
  };

  render = () => <Div globalShortcuts={this.globalShortcuts}>
    {this.state.filterMode && <RequestBar
      initialValue={this.state.filter}
      label={`Dependency filter`}
      onChange={this.handleFilterChange}
      onCommit={this.handleFilterCommit}
      onRollback={this.handleFilterRollback}
    />}
    
    {!this.state.filterMode && <TopBar
      widgets={this.state.widgets}
    />}

    <Div>
      {iterate(this.props.project.workspacesByCwd.keys(), cwd =>
        <WorkspaceView key={cwd} cwd={cwd} filterRegexp={this.state.filterRegexp} />
      )}
    </Div>
  </Div>;
}

const ConnectedWorkspacesScreen = connect(({project}: {project: Project}) => ({
  project,
}))(WorkspacesScreen);

export {
  ConnectedWorkspacesScreen as WorkspacesScreen,
};
