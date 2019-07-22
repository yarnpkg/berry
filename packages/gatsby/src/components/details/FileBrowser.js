import React              from 'react';
import CSSTransitionGroup from 'react-transition-group/CSSTransitionGroup';
import fetch              from 'unfetch';
import bytes              from 'bytes';
import styled             from '@emotion/styled';

import IcoFolder          from '../../images/detail/ico-folder.svg';
import IcoFile            from '../../images/detail/ico-file.svg';

const SORT_ORDER = { directory: 1, file: 2 };

const ListItem = styled.li`
  list-style-type: none;
  padding: 0.2em;
  &:hover {
    background-color: #eceeef;
    border-radius: 0.2em;
  }
  a:before {
    content: '';
    display: inline-block;
    height: 22px;
    margin-right: 4px;
    width: 22px;
    vertical-align: middle;
  }
  .details-files-enter {
    max-height: 0;
    opacity: 0;
    transition: all 200ms ease-in;
  }
  .details-files-enter-active {
    max-height: 500px;
    opacity: 1;
  }
  .details-files-leave {
    max-height: 500px;
    opacity: 1;
    transition: all 200ms ease-out;
  }
  .details-files-leave-active {
    max-height: 0;
    opacity: 0;
  }
`;

const DirItem = styled(ListItem)`
  a:before {
    background-image: url(${IcoFolder});
  }
`;

const FileItem = styled(ListItem)`
  align-items: baseline;
  display: flex;
  justify-content: space-between;
  a:before {
    background-image: url(${IcoFile});
  }
`;

const FileList = styled.ul`
  color: #5a5a5a;
  list-style-type: none;
  padding-left: 0;
  ul {
    padding-left: 1.5em;
    background-color: white;
  }
`;

const FilesHeader = styled.div`
  color: #5a5a5a;

  h2 {
    font-size: 32px;
    font-weight: 600;
    margin: 8px 0;
  }

  button {
    color: #117cad;
    cursor: pointer;
    text-decoration: none;
    border: none;
    font-size: 16px;
    padding: 0;
    &:hover {
      color: #0a4a67;
      text-decoration: underline;
    }
    &:focus {
      outline: none;
    }
  }
`;

const Alert = styled.div`
  margin-top: -1.5rem;
`;

export default class FileBrowser extends React.PureComponent {
  state = {
    expandedDirs: {
      '/': true,
    },
  };

  componentWillMount() {
    this._fetchFiles();
  }

  componentDidMount() {
    if (this._backRef) {
      this._backRef.focus();
    }
  }

  _fetchFiles() {
    this.setState({ error: null, files: null });
    const url = this._getURLForPackageMetadata();
    fetch(url)
      .then(response => {
        // If status code >= 400 handle it as an error.
        if (!response.ok) {
          return response.json().then(body => {
            throw body;
          });
        }
        return response;
      })
      .then(response => response.json())
      .then(
        files => this.setState({ files }),
        error => this.setState({ error })
      );
  }

  render() {
    return (
      <FilesHeader>
        <h2>
          {`Files in ${this.props.objectID}`}
        </h2>
        <button ref={this._setBackRef} onClick={this.props.onBackToDetails}>
          ← Back to Details
        </button>
        {this._renderInner()}
      </FilesHeader>
    );
  }

  _renderInner() {
    if (this.state.files) {
      return (
        <Directory
          name="/"
          path="/"
          baseURL={this._getBaseURL()}
          dir={this.state.files}
          expandedDirs={this.state.expandedDirs}
          onToggleDir={this._toggleDir}
        />
      );
    }
    if (this.state.error) {
      return (
        <Alert role="alert">
          {`Could not load file listing: ${this.state.error.message}`}
        </Alert>
      );
    }
    return <div>Loading...</div>;
  }

  _getBaseURL() {
    return `https://cdn.jsdelivr.net/npm/${this.props.objectID}@${
      this.props.version
    }`;
  }

  _getURLForPackageMetadata() {
    return `https://data.jsdelivr.com/v1/package/npm/${this.props.objectID}@${
      this.props.version
    }`;
  }

  _toggleDir = path => {
    this.setState(({ expandedDirs }) => ({
      expandedDirs: {
        ...expandedDirs,
        [path]: !expandedDirs[path],
      },
    }));
  };

  _setBackRef = ref => {
    this._backRef = ref;
  };
}

class Directory extends React.PureComponent {
  render() {
    const path = this.props.path;
    const url = this.props.baseURL + path;
    if (path === '/') {
      // Special case for root - Only render the contents, not the outer
      // wrapper.
      return this._renderDirContents();
    }
    return (
      <DirItem key={path}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={this._toggleDir}
        >
          {this.props.name}
        </a>
        <CSSTransitionGroup
          transitionName="details-files"
          transitionEnterTimeout={600}
          transitionLeaveTimeout={600}
        >
          {this._renderDirContents()}
        </CSSTransitionGroup>
      </DirItem>
    );
  }

  _renderDirContents() {
    if (!this.props.expandedDirs[this.props.path]) {
      return null;
    }
    const files = this.props.dir.files;

    files.sort((a, b) => {
      // Sort by type (directories to the top)
      if (a.type !== b.type) {
        return SORT_ORDER[a.type] - SORT_ORDER[b.type];
      }
      // Then sort by filename, case insensitive
      return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    });

    return (
      <FileList>
        {files.map(file => {
          if (file.type === 'directory') {
            return (
              <Directory
                baseURL={this.props.baseURL}
                dir={file}
                name={file.name}
                path={this.props.path + file.name + '/'}
                expandedDirs={this.props.expandedDirs}
                key={this.props.path + file.name}
                onToggleDir={this.props.onToggleDir}
              />
            );
          } else {
            return (
              <File
                file={file}
                name={file.name}
                key={this.props.path + file.name}
                url={this.props.baseURL + this.props.path + file.name}
                size={file.size}
              />
            );
          }
        })}
      </FileList>
    );
  }

  _toggleDir = evt => {
    this.props.onToggleDir(this.props.path);
    evt.preventDefault();
  };
}

const File = ({ file, url, key, size }) => (
  <FileItem key={key}>
    <a href={url} target="_blank" rel="noopener noreferrer">
      {file.name}
    </a>
    <small>{bytes(size)}</small>
  </FileItem>
);
