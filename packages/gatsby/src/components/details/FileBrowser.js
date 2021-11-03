import styled                                         from '@emotion/styled';
import bytes                                          from 'bytes';
import CSSTransitionGroup                             from 'react-transition-group/CSSTransitionGroup';
import {useState, useEffect, useLayoutEffect, useRef} from 'react';
import React                                          from 'react';
import fetch                                          from 'unfetch';

import IcoFile                                        from '../../images/detail/ico-file.svg';
import IcoFolder                                      from '../../images/detail/ico-folder.svg';

const SORT_ORDER = {directory: 1, file: 2};

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

export const FileBrowser = ({objectID, version, onBackToDetails}) => {
  const [state, setState] = useState({error: null, files: null, expandedDirs: {'/': true}});
  const backRef = useRef();

  const fetchFiles = () => {
    (async () => {
      const url = `https://data.jsdelivr.com/v1/package/npm/${objectID}@${version}`;
      const response = await fetch(url);
      const {error, files} = await response.json();

      if (!response.ok) {
        setState({...state, error});
      } else {
        setState({...state, files});
      }
    })();
  };

  useLayoutEffect(fetchFiles, [objectID, version]);

  useEffect(() => {
    backRef.current.focus();
  }, []);

  const toggleDir = path => {
    setState({
      ...state,
      expandedDirs: {
        ...state.expandedDirs,
        [path]: !state.expandedDirs[path],
      },
    });
  };

  const renderInner = () => {
    if (state.files) {
      const baseURL = `https://cdn.jsdelivr.net/npm/${objectID}@${version}`;

      return (
        <Directory
          name={`/`}
          path={`/`}
          baseURL={baseURL}
          files={state.files}
          expandedDirs={state.expandedDirs}
          onToggleDir={toggleDir}
        />
      );
    } else if (state.error) {
      return (
        <Alert role={`alert`}>
          {`Could not load file listing: ${state.error.message}`}
        </Alert>
      );
    } else {
      return <div>Loading...</div>;
    }
  };

  return (
    <FilesHeader>
      <h2>
        {`Files in ${objectID}`}
      </h2>
      <button ref={backRef} onClick={onBackToDetails}>
        ← Back to Details
      </button>
      {renderInner()}
    </FilesHeader>
  );
};

const Directory = ({name, path, baseURL, expandedDirs, files, onToggleDir}) => {
  const url = baseURL + path;

  const toggleDir = evt => {
    onToggleDir(path);
    evt.preventDefault();
  };

  const renderDirContents = () => {
    if (!expandedDirs[path])
      return null;


    files.sort((a, b) => {
      // Sort by type (directories to the top)
      if (a.type !== b.type)
        return SORT_ORDER[a.type] - SORT_ORDER[b.type];

      // Then sort by filename, case insensitive
      return a.name.localeCompare(b.name, `en`, {sensitivity: `base`});
    });

    return (
      <FileList>
        {files.map(file => {
          if (file.type === `directory`) {
            return (
              <Directory
                baseURL={baseURL}
                files={file.files}
                name={file.name}
                path={`${path + file.name}/`}
                expandedDirs={expandedDirs}
                key={path + file.name}
                onToggleDir={onToggleDir}
              />
            );
          } else {
            return (
              <File
                file={file}
                name={file.name}
                key={path + file.name}
                url={baseURL + path + file.name}
                size={file.size}
              />
            );
          }
        })}
      </FileList>
    );
  };


  if (path === `/`) {
    // Special case for root - Only render the contents, not the outer
    // wrapper.
    return renderDirContents();
  } else {
    return (
      <DirItem key={path}>
        <a
          href={url}
          target={`_blank`}
          rel={`noopener noreferrer`}
          onClick={toggleDir}
        >
          {name}
        </a>
        <CSSTransitionGroup
          transitionName={`details-files`}
          transitionEnterTimeout={600}
          transitionLeaveTimeout={600}
        >
          {renderDirContents()}
        </CSSTransitionGroup>
      </DirItem>
    );
  }
};

const File = ({file, url, key, size}) => (
  <FileItem key={key}>
    <a href={url} target={`_blank`} rel={`noopener noreferrer`}>
      {file.name}
    </a>
    <small>{bytes(size)}</small>
  </FileItem>
);
