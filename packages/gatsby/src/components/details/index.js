import React, { Component } from 'react';
import bytes from 'bytes';
import algoliasearch from 'algoliasearch/lite';
import qs from 'qs';
import formatDistance from 'date-fns/formatDistance';

import Aside from './Aside';
import FileBrowser from './FileBrowser';
import Copyable from './Copyable';
import Header from './Header';
import JSONLDItem from './JSONLDItem';
import ReadMore from './ReadMore';
import Markdown from './Markdown';
import schema from '../schema';
import { prefixURL, get, packageLink, i18nReplaceVars } from '../util';
import { algolia } from '../config';

const client = algoliasearch(algolia.appId, algolia.apiKey);
const index = client.initIndex(algolia.indexName);

const readmeErrorMessage = 'ERROR: No README data found!';

export const Di = ({ icon, title, description }) => (
  <div className="d-flex justify-items-between w-100">
    {icon && <img src={`/assets/detail/ico-${icon}.svg`} alt="" />}
    <dt>{title}</dt>
    <span className="dotted flex-grow" />
    <dd>{description}</dd>
  </div>
);

function setHead({ name, description }) {
  const head = document.querySelector('head');
  const permalink = `https://yarnpkg.com${packageLink(name)}`;
  head.querySelector('meta[property="og:title"]').setAttribute('content', name);
  document.title = `${name} | Yarn`;
  head
    .querySelector('meta[name=description]')
    .setAttribute('content', description);
  head
    .querySelector('meta[property="og:description"]')
    .setAttribute('content', description);
  head
    .querySelector('meta[property="og:url"]')
    .setAttribute('content', permalink);
  head.querySelector('link[rel=canonical]').setAttribute('href', permalink);
}

const OBJECT_DOESNT_EXIST = 'ObjectID does not exist';

class Details extends Component {
  constructor(props) {
    super(props);
    this.getGithub = this.getGithub.bind(this);
    this.state = {
      ...schema,
      isBrowsingFiles: false,
    };
  }

  componentDidMount() {
    index
      .getObject(this.props.objectID)
      .then(content => {
        this.setState(prevState => ({ ...content, loaded: true }));
        setHead(content);
        this.getDocuments();

        // Opens the file browser if the search has a 'files' param.
        const { files } = qs.parse(window.location.search, {
          ignoreQueryPrefix: true,
        });

        if (files !== undefined) {
          this.setState({ isBrowsingFiles: true });
        }
      })
      .catch(e => {
        if (e.message === OBJECT_DOESNT_EXIST) {
          this.setState({
            objectDoesntExist: true,
          });
        }
      });

    window.addEventListener('popstate', this._onPopState);
  }

  componentWillUnmount() {
    window.removeEventListener('popstate', this._onPopState);
  }

  getGithub({ url, state }) {
    return get({
      url: `https://api.github.com/${url}`,
      type: 'json',
    })
      .then(res => this.setState({ [state]: res }))
      .catch(err => {
        if (err === 'retry') {
          setTimeout(this.getGithub({ url, state }), 200);
        }
      });
  }

  // Get repository details, like stars, changelog, commit activity and so on
  getRepositoryDetails({ user, project, host, branch, path }) {
    const { readme, changelogFilename } = this.state;
    const hasReadme =
      readme && readme.length > 0 && readme !== readmeErrorMessage;

    if (host === 'github.com') {
      if (changelogFilename) {
        get({
          url: changelogFilename,
          type: 'text',
        }).then(res => this.setState({ changelog: res }));
      }

      if (!hasReadme) {
        this.setState({ readmeLoading: true });
        get({
          url: prefixURL('README.md', {
            base: 'https://raw.githubusercontent.com',
            user,
            project,
            head: branch,
            path: path.replace(/\/tree\//, ''),
          }),
          type: 'text',
        })
          .then(res => this.setState({ readme: res }))
          .catch(() => this.setState({ readmeLoading: false }));
      }

      this.getGithub({
        url: `repos/${user}/${project}/stats/commit_activity`,
        state: 'activity',
      });

      this.getGithub({
        url: `repos/${user}/${project}`,
        state: 'github',
      });
    } else if (host === 'gitlab.com') {
      const getGitlabFile = ({ user, project, branch, filePath }) => {
        // We need to use the Gitlab API because the raw url does not support cors
        // https://gitlab.com/gitlab-org/gitlab-ce/issues/25736
        // So we need to 'translate' raw urls to api urls.
        // E.g (https://gitlab.com/janslow/gitlab-fetch/raw/master/CHANGELOG.md) -> (https://gitlab.com/api/v4/projects/janslow%2Fgitlab-fetch/repository/files/CHANGELOG.md?ref=master)
        // Once gitlab adds support, we can get rid of this workaround.
        const apiUrl = `https://gitlab.com/api/v4/projects/${user}%2F${project}/repository/files/${encodeURIComponent(
          filePath
        )}?ref=${branch}`;
        return get({
          url: apiUrl,
          type: 'json',
        }).then(res => res.encoding === 'base64' && atob(res.content));
      };

      get({
        url: `https://gitlab.com/api/v4/projects/${user}%2F${project}`,
        type: 'json',
      }).then(res => this.setState({ gitlab: res }));

      // Fetch last commit
      get({
        url: `https://gitlab.com/api/v4/projects/${user}%2F${project}/repository/commits?per_page=1`,
        type: 'json',
      }).then(([{ committed_date }]) => {
        this.setState({
          activity: {
            lastCommit: i18nReplaceVars('{time_distance} ago', {
              time_distance: formatDistance(
                new Date(committed_date),
                new Date()
              ),
            }),
          },
        });
      });

      if (!hasReadme) {
        this.setState({ readmeLoading: true });

        getGitlabFile({
          user,
          project,
          branch,
          filePath: `${path}/README.md`,
        })
          .then(res => this.setState({ readme: res }))
          .catch(() => this.setState({ readmeLoading: false }));
      }

      if (changelogFilename) {
        // Extract information from raw url
        // See comment in getGitlabFile
        const [, user, project, branch, filePath] = changelogFilename.match(
          /^https?:\/\/gitlab.com\/([^/]+)\/([^/]+)\/raw\/([^/]+)\/(.*)$/i
        );

        getGitlabFile({ user, project, branch, filePath }).then(res =>
          this.setState({ changelog: res })
        );
      }
    } else if (host === 'bitbucket.org') {
      if (!hasReadme) {
        this.setState({ readmeLoading: true });

        get({
          url: `https://bitbucket.org/${user}/${project}${
            path ? path.replace('src', 'raw') : `/raw/${branch}`
          }/README.md`,
          type: 'text',
          redirect: 'error', // Prevent being redirected to login page
        })
          .then(res => this.setState({ changelog: res }))
          .catch(() => this.setState({ readmeLoading: false }));
      }

      // Fetch last commit
      get({
        url: `https://api.bitbucket.org/2.0/repositories/${user}/${project}/commits?pagelen=1`,
        type: 'json',
      }).then(({ values: [{ date }] }) => {
        this.setState({
          activity: {
            lastCommit: i18nReplaceVars('{time_distance} ago', {
              time_distance: formatDistance(new Date(date), new Date()),
            }),
          },
        });
      });

      if (changelogFilename) {
        get({
          url: changelogFilename,
          type: 'text',
          redirect: 'error', // Prevent being redirected to login page
        }).then(res => this.setState({ changelog: res }));
      }
    }
  }

  getDocuments() {
    const { repository, name, version } = this.state;

    if (repository && repository.host) {
      this.getRepositoryDetails(repository);
    }

    get({
      url: `https://bundlephobia.com/api/size?package=${name}@${version}`,
      type: 'json',
    }).then(res =>
      this.setState({
        bundlesize: {
          href: `https://bundlephobia.com/result?p=${name}@${version}`,
          size: bytes(res.size),
          gzip: bytes(res.gzip),
        },
      })
    );
  }

  maybeRenderReadme() {
    if (this.state.loaded) {
      const { readmeLoading, readme = '' } = this.state;
      if (readme.length === 0 || readme === readmeErrorMessage) {
        // Still loading
        if (readmeLoading) {
          return null;
        }
        return <div>no readme found <span role="img" aria-label="sad emotion">😢</span></div>;
      }
      return (
        <ReadMore
          text="Display full readme"
          className="details-doc--content"
        >
          <Markdown
            source={this.state.readme}
            repository={this.state.repository}
          />
        </ReadMore>
      );
    } else {
      return null;
    }
  }

  render() {
    if (this.state.isBrowsingFiles) {
      return this._renderFileBrowser();
    }
    if (this.state.objectDoesntExist) {
      return this._renderInvalidPackage();
    }
    return this._renderDetails();
  }

  _renderInvalidPackage() {
    return (
      <section className="text-center d-flex flex-column">
        <h2 className="details-main--title d-inline-block m-2">
          {'Whoa, {package_name} does not exist yet'.replace(
            '{package_name}',
            this.props.objectID
          )}
        </h2>
        <p>But that means it is now yours!</p>
        <div className="text-left mx-auto">
          <Copyable pre="$ ">mkdir {this.props.objectID}</Copyable>
          <Copyable pre="$ ">cd {this.props.objectID}</Copyable>
          <Copyable pre="$ ">yarn init</Copyable>
          <p className="text-center">Make your package</p>
          <Copyable pre="$ ">yarn publish</Copyable>
        </div>
      </section>
    );
  }

  _renderDetails() {
    return (
      <div className="details row">
        <section className="details-main col-lg-8">
          <Header
            name={this.state.name}
            owner={this.state.owner}
            downloadsLast30Days={this.state.downloadsLast30Days}
            humanDownloadsLast30Days={this.state.humanDownloadsLast30Days}
            description={this.state.description}
            license={this.state.license}
            deprecated={this.state.deprecated}
            keywords={this.state.keywords}
            version={this.state.version}
          />
          <section id="readme" className="details-doc">
            <h3 className="details-doc--title details-doc--title__readme py-1">
              <a href="#readme">readme</a>
            </h3>
            {this.maybeRenderReadme()}
          </section>
          {this.state.changelog && (
            <section id="changelog" className="details-doc">
              <h3 className="details-doc--title details-doc--title__changelog py-1">
                <a href="#changelog">changelog</a>
              </h3>
              <ReadMore
                text="Display full changelog"
                className="details-doc--content"
              >
                <Markdown
                  source={this.state.changelog}
                  repository={this.state.repository}
                />
              </ReadMore>
            </section>
          )}
        </section>

        {this._renderSidebar()}

        <JSONLDItem
          name={this.state.name}
          description={this.state.description}
          keywords={this.state.keywords}
        />
      </div>
    );
  }

  _renderSidebar() {
    return (
      <Aside
        name={this.state.name}
        repository={this.state.repository}
        homepage={this.state.homepage}
        contributors={this.state.owners}
        activity={this.state.activity}
        downloads={this.state.downloadsLast30Days}
        humanDownloads={this.state.humanDownloadsLast30Days}
        dependencies={this.state.dependencies}
        devDependencies={this.state.devDependencies}
        dependents={this.state.dependents}
        humanDependents={this.state.humanDependents}
        stargazers={this._getRepositoryStarCount()}
        versions={this.state.versions}
        version={this.state.version}
        tags={this.state.tags}
        bundlesize={this.state.bundlesize}
        onOpenFileBrowser={this._openFileBrowser}
        jsDelivrHits={this.state.jsDelivrHits}
      />
    );
  }

  _renderFileBrowser() {
    return (
      <div className="details row">
        <section className="details-main col-lg-8">
          <FileBrowser
            objectID={this.props.objectID}
            version={this.state.version}
            onBackToDetails={this._closeFileBrowser}
          />
        </section>
        {this._renderSidebar()}
      </div>
    );
  }

  _getRepositoryStarCount = () => {
    const { github, gitlab, repository } = this.state;

    if (
      !repository ||
      !repository.host ||
      repository.host === 'bitbucket.org'
    ) {
      return -1;
    }

    if (repository.host === 'github.com' && github) {
      return this.state.github.stargazers_count;
    }
    if (repository.host === 'gitlab.com' && gitlab) {
      return this.state.gitlab.star_count;
    }
    return 0;
  };

  _openFileBrowser = evt => {
    // Ignore if is already browsing the files (prevent pushing state to the history repeatedly)
    if (!this.state.isBrowsingFiles) {
      this._setFilesSearchParam(true);

      this.setState({ isBrowsingFiles: true });
    }
    evt.preventDefault();
  };

  _closeFileBrowser = evt => {
    this._setFilesSearchParam(false);

    this.setState({ isBrowsingFiles: false });
    evt.preventDefault();
  };

  // Add/remove the 'files' param from the search (push to the history)
  _setFilesSearchParam = active => {
    // The strictNullHandling option is used to avoid that the qs includes a '=' at the end of empty params
    const search = qs.parse(window.location.search, {
      ignoreQueryPrefix: true,
      strictNullHandling: true,
    });

    if (active) {
      search.files = null;
    } else {
      delete search.files;
    }

    window.history.pushState(
      null,
      null,
      window.location.pathname +
        qs.stringify(search, { addQueryPrefix: true, strictNullHandling: true })
    );
  };

  _onPopState = ({ state }) => {
    // Open or close the file browser based on the current search
    const { files } = qs.parse(window.location.search, { ignoreQueryPrefix: true });

    if (files !== undefined) {
      this.setState({ isBrowsingFiles: true });
    } else if (this.state.isBrowsingFiles) {
      this.setState({ isBrowsingFiles: false });
    }
  };
}

export default Details;
