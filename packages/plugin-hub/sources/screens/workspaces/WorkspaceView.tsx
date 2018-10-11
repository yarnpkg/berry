import React = require('react');

import {iterate}                                     from '@berry/ui/sources/tools';
import {FocusGroup}                                  from '@berry/ui/sources/widgets/FocusGroup';
import {Div, StyleFlexDirectionEnum}                 from '@berry/ui';
import {Project, Workspace, Descriptor, structUtils} from '@berry/core';
import {connect}                                     from 'react-redux';

import {EditModeItem}                                from '../../components/EditModeItem'

const mainStyle = {
  marginBottom: 1,
};

const infoStyle = {
  flexDirection: StyleFlexDirectionEnum.Row,

  backgroundColor: `#ffffff`,
};

const nameStyle = {
  marginLeft: 0,
  marginRight: `auto`,

  color: `black`,
};

const cwdStyle = {
  marginLeft: `auto`,
  marginRight: 0,

  color: `#333333`,
};

const contentStyle = {
  flexDirection: StyleFlexDirectionEnum.Row,
};

const columnStyle = {
  width: 40,

  marginRight: 1,
};

const headerStyle = {
  marginBottom: 1,
};

export type WorkspaceViewProps = {
  cwd: string,
  filterRegexp: RegExp | null,
  workspace: Workspace,
};

export type WorkspaceViewState = {
};

class WorkspaceView extends React.PureComponent<WorkspaceViewProps, WorkspaceViewState> {
  ignoreDescriptor(descriptor: Descriptor) {
    if (!this.props.filterRegexp)
      return false;

    if (this.props.filterRegexp.test(structUtils.prettyIdent(descriptor)))
      return false;
    
    return true;
  }

  render = () => {
    const dependencies = Array.from(this.props.workspace.manifest.dependencies.values()).filter(descriptor => {
      return !this.ignoreDescriptor(descriptor);
    });

    const devDependencies = Array.from(this.props.workspace.manifest.devDependencies.values()).filter(descriptor => {
      return !this.ignoreDescriptor(descriptor);
    });

    // Just don't display the workspace if it doesn't have any dependency matching the ones we're looking for
    if (this.props.filterRegexp && dependencies.length === 0 && devDependencies.length === 0)
      return null;

    return (
      <Div style={mainStyle}>
        <Div style={infoStyle}>
          <Div style={nameStyle}>
            {structUtils.prettyLocator(this.props.workspace.locator)}
          </Div>
          <Div style={cwdStyle}>
            {this.props.workspace.cwd}
          </Div>
        </Div>

        <FocusGroup>{FocusEntry => 
          <Div style={contentStyle}>
            <Div style={columnStyle}>
              <Div style={headerStyle}>
                Regular dependencies
              </Div>
              {iterate(dependencies, (descriptor, index) =>
                <FocusEntry key={descriptor.descriptorHash} column={1} row={index}>
                  <EditModeItem editLabel={`${structUtils.prettyIdent(descriptor)} @ `} editInitialValue={descriptor.range}>
                    {structUtils.prettyIdent(descriptor)} @ {descriptor.range}
                  </EditModeItem>
                </FocusEntry>
              , `n/a`)}
            </Div>

            <Div style={columnStyle}>
              <Div style={headerStyle}>
                -> resolutions
              </Div>
              {iterate(dependencies, (descriptor, index) =>
                <FocusEntry key={descriptor.descriptorHash} column={2} row={index}>
                  <EditModeItem editLabel={`${structUtils.prettyIdent(descriptor)} @ `} editInitialValue={descriptor.range}>
                    {structUtils.prettyIdent(descriptor)} @ {descriptor.range}
                  </EditModeItem>
                </FocusEntry>
              , `n/a`)}
            </Div>

            <Div style={columnStyle}>
              <Div style={headerStyle}>
                Dev dependencies
              </Div>
              {iterate(devDependencies, (descriptor, index) =>
                <FocusEntry key={descriptor.descriptorHash} column={3} row={index}>
                  <EditModeItem editLabel={`${structUtils.prettyIdent(descriptor)} @ `} editInitialValue={descriptor.range}>
                    {structUtils.prettyIdent(descriptor)} @ {descriptor.range}
                  </EditModeItem>
                </FocusEntry>
              , `n/a`)}
            </Div>

            <Div style={columnStyle}>
              <Div style={headerStyle}>
                -> resolutions
              </Div>
              {iterate(devDependencies, (descriptor, index) =>
                <FocusEntry key={descriptor.descriptorHash} column={4} row={index}>
                  <EditModeItem editLabel={`${structUtils.prettyIdent(descriptor)} @ `} editInitialValue={descriptor.range}>
                    {structUtils.prettyIdent(descriptor)} @ {descriptor.range}
                  </EditModeItem>
                </FocusEntry>
              , `n/a`)}
            </Div>
          </Div>
        }</FocusGroup>
      </Div>
    );
  }
}

const ConnectedWorkspaceView = connect(({project}: {project: Project}, {cwd}: {cwd: string}) => ({
  workspace: project.workspacesByCwd.get(cwd) as Workspace,
}))(WorkspaceView);

export {
  ConnectedWorkspaceView as WorkspaceView,
};
