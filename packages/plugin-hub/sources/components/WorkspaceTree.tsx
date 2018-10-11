import React = require('react');

import {Project, Workspace}          from '@berry/core';
import {structUtils}                 from '@berry/core';
import {Div, StyleFlexDirectionEnum} from '@berry/ui';
import {FocusGroup}                  from '@berry/ui/sources/widgets/FocusGroup';
import {Input}                       from '@berry/ui/sources/widgets/Input';

function orEmpty(array: Array<any>, fn: () => any) {
  return array.length > 0 ? array : fn();
}

const descriptorEntryStyle = {
  flexDirection: StyleFlexDirectionEnum.Row,

  backgroundColor: undefined,
  color: undefined,
};

const focusedDescriptorEntryStyle = {
  backgroundBackColor: `#2188b6`,

  contentFrontColor: `#ffffff`,
};

const editedDescriptorEntryStyle = {
  backgroundBackColor: `orange`,

  contentFrontColor: `#ffffff`,
};

const descriptorInputStyle = {
  flex: 1,

  backgroundBackColor: `orange`,

  contentFrontColor: `#ffffff`,
};

class DescriptorEntry extends React.PureComponent<any, any> {
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

  private handleRollbackEditViaShortcut = (e: any) => {
    if (!this.state.edited)
      return;

    e.preventDefault();

    this.setState({edited: false});
    this.triggerFocus();
  };

  private handleRollbackEditViaBlur = () => {
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
    [`escape`]: this.handleRollbackEditViaShortcut,
    [`e`]: this.handleStartEdit,
  };

  render = () => {
    const content = this.state.edited
      ? <Input style={descriptorInputStyle} autofocus={true} monoline={true} onBlur={this.handleRollbackEditViaBlur} onEnterKey={this.handleConfirmEdit} defaultValue={this.props.descriptor.range} />
      : <div>{this.props.descriptor.range}</div>;
    
    const style = this.state.edited
      ? editedDescriptorEntryStyle
      : this.state.focused
        ? focusedDescriptorEntryStyle
        : descriptorEntryStyle;
    
    return <Div ref={this.mainRef} tabIndex={0} onFocus={this.handleFocus} onBlur={this.handleBlur} style={style} shortcuts={{... this.shortcuts, ... this.props.shortcuts}}>
      <div>{structUtils.prettyIdent(this.props.descriptor)}@</div>
      {content}
    </Div>;
  }
}

const resolutionEntryStyle = {
  backgroundColor: undefined,
  color: undefined,
};

const focusedResolutionEntryStyle = {
  backgroundColor: `#2188b6`,
  color: `#ffffff`,
};

class ResolutionEntry extends React.PureComponent<any, any> {
  mainRef = React.createRef<Div>();

  state = {
    focused: false,
  };
  
  handleFocus = () => {
    this.setState({focused: true});

    if (this.props.onFocus) {
      this.props.onFocus();
    }
  };

  handleBlur = () => {
    this.setState({focused: false});

    if (this.props.onBlur) {
      this.props.onBlur();
    }
  };

  triggerFocus() {
    if (this.mainRef.current) {
      // @ts-ignore
      this.mainRef.current.triggerFocus();
    }
  }

  render = () => <Div ref={this.mainRef} tabIndex={0} onFocus={this.handleFocus} onBlur={this.handleBlur} style={this.state.focused ? focusedResolutionEntryStyle : resolutionEntryStyle} shortcuts={this.props.shortcuts}>
    {this.props.pkg ? structUtils.prettyLocator(this.props.pkg) : `unresolved`}
  </Div>;
}

type WorkspaceTreeProps = {
  project: Project,
  workspace: Workspace | null,
};

const workspaceTreeStyle = {
};

const workspaceEntryStyle = {
  flexDirection: StyleFlexDirectionEnum.Row,

  backgroundColor: `#ffffff`,
};

const workspaceEntryStyleNthp1 = {
  ... workspaceEntryStyle,

  marginTop: 1,
};

const workspaceNameStyle = {
  marginLeft: 0,
  marginRight: `auto`,

  color: `black`,
};

const workspaceCwdStyle = {
  marginLeft: `auto`,
  marginRight: 0,

  color: `#333333`,
};

const workspaceContentStyle = {
  flexDirection: StyleFlexDirectionEnum.Row,
};

const workspaceContentColumnStyle = {
  width: 40,

  marginRight: 1,
};

const workspaceContentHeaderStyle = {
  marginBottom: 1,
};

export class WorkspaceTree extends React.PureComponent<WorkspaceTreeProps, any> {
  render = () => <Div style={workspaceTreeStyle}>
    {Array.from(this.props.project.workspacesByLocator.values()).map((workspace, index) => <Div key={workspace.locator.locatorHash}>
      <Div style={index === 0 ? workspaceEntryStyle : workspaceEntryStyleNthp1}>
        <Div style={workspaceNameStyle}>
          {structUtils.prettyLocator(workspace.locator)}
        </Div>
        <Div style={workspaceCwdStyle}>
          {workspace.cwd}
        </Div>
      </Div>

      <FocusGroup>{FocusEntry => 
        <Div style={workspaceContentStyle}>
          <Div style={workspaceContentColumnStyle}>
            <Div style={workspaceContentHeaderStyle}>
              Regular dependencies
            </Div>
            {orEmpty(Array.from(workspace.manifest.dependencies.values()).map((descriptor, idx) => {
              return <FocusEntry key={descriptor.descriptorHash} column={0} row={idx}>
                <DescriptorEntry descriptor={descriptor} />
              </FocusEntry>;
            }), () => `n/a`)}
          </Div>

          <Div style={workspaceContentColumnStyle}>
            <Div style={workspaceContentHeaderStyle}>
              -> resolutions
            </Div>
            {orEmpty(Array.from(workspace.manifest.dependencies.values()).map((descriptor, idx) => {
              const resolution = this.props.project.storedResolutions.get(descriptor.descriptorHash);
              const pkg = resolution ? this.props.project.storedPackages.get(resolution) : null;

              return <FocusEntry key={descriptor.descriptorHash} column={1} row={idx}>
                <ResolutionEntry descriptor={descriptor} pkg={pkg} />
              </FocusEntry>;
            }), () => `n/a`)}
          </Div>

          <Div style={workspaceContentColumnStyle}>
            <Div style={workspaceContentHeaderStyle}>
              Dev dependencies
            </Div>
            {orEmpty(Array.from(workspace.manifest.devDependencies.values()).map((descriptor, idx) => {
              return <FocusEntry key={descriptor.descriptorHash} column={2} row={idx}>
                <DescriptorEntry descriptor={descriptor} />
              </FocusEntry>;
            }), () => `n/a`)}
          </Div>

          <Div style={workspaceContentColumnStyle}>
            <Div style={workspaceContentHeaderStyle}>
              -> resolutions
            </Div>
            {orEmpty(Array.from(workspace.manifest.devDependencies.values()).map((descriptor, idx) => {
              const resolution = this.props.project.storedResolutions.get(descriptor.descriptorHash);
              const pkg = resolution ? this.props.project.storedPackages.get(resolution) : null;

              return <FocusEntry key={descriptor.descriptorHash} column={3} row={idx}>
                <ResolutionEntry descriptor={descriptor} pkg={pkg} />
              </FocusEntry>;
            }), () => `n/a`)}
          </Div>
        </Div>
      }</FocusGroup>
    </Div>)}
  </Div>;
}
