import styled             from '@emotion/styled';
import algoliasearch      from 'algoliasearch';
import bytes              from 'bytes';
import formatDistance     from 'date-fns/formatDistance';
import qs                 from 'qs';
import React, {Component} from 'react';

import IcoChangelog       from '../../images/detail/ico-changelog.svg';
import IcoCommitsLast     from '../../images/detail/ico-commits-last.svg';
import IcoCommits         from '../../images/detail/ico-commits.svg';
import IcoDependencies    from '../../images/detail/ico-dependencies.svg';
import IcoDependents      from '../../images/detail/ico-dependents.svg';
import IcoDevDependencies from '../../images/detail/ico-devdependencies.svg';
import IcoDownloadSize    from '../../images/detail/ico-download-size.svg';
import IcoDownloads       from '../../images/detail/ico-downloads.svg';
import IcoPackageJson     from '../../images/detail/ico-package-json.svg';
import IcoReadme          from '../../images/detail/ico-readme.svg';
import IcoStargazers      from '../../images/detail/ico-stargazers.svg';
import {algolia}          from '../config';
import {ifDesktop}        from '../responsive';
import {schema}           from '../schema';
import {prefixURL, get}   from '../util';

import {Aside}            from './Aside';
import {Copyable}         from './Copyable';
import {FileBrowser}      from './FileBrowser';
import {Header}           from './Header';
import {JSONLDItem}       from './JSONLDItem';
import {Markdown}         from './Markdown';
import {ReadMore}         from './ReadMore';

const client = algoliasearch(algolia.appId, algolia.apiKey);
const index = client.initIndex(algolia.indexName);

const readmeErrorMessage = `ERROR: No README data found!`;

const Container = styled.div`
  margin: 0 auto;
  padding: 0 15px;
  width: 1140px;
  max-width: 100%;
  display: flex;
  flex-wrap: wrap;
`;

const InvalidPackage = styled(Container)`
  flex-direction: column;
  text-align: center;
  color: #5a5a5a;

  p, h2 {
    margin: .5rem .5rem;
    text-align: center;
  }

  section {
    background-color: #eceeef;
    padding: 1em;
  }
`;

const Instructions = styled.div`
  text-align: left;
  margin: 0 auto;
`;

const FileBrowserColumn = styled.section`
  width: 100%;
  ${ifDesktop} {
    width: calc(100% * 2 / 3);
    padding: 0 15px;
  }
`;

const DiBox = styled.div`
  margin-bottom: 0.5em;
  width: 100%;
  display: flex;
  font-size: 0.9rem;

  dt {
    details:focus, summary:focus {
      outline: none;
    }
    font-weight: normal;
    align-self: flex-end;
    display: block;
  }

  span {
    flex-grow: 1;
    border-bottom: 1px dotted #666;
    margin: 0 0.5em 5px 0.5em;
  }

  dd {
    margin-left: 0;
    font-weight: bold;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-size-adjust: 100%;
    span {
      margin: 0;
      border: none;
    }
    a:hover {
      color: #0a4a67;
      text-decoration: underline;
    }
  }

  img {
    height: 1.4em;
    width: 1.4em;
    margin-right: 0.4em;
    align-self: center;
    vertical-align: middle;
    border-style: none;
  }
`;

const icons = {
  commits: IcoCommits,
  'commits-last': IcoCommitsLast,
  dependencies: IcoDependencies,
  dependents: IcoDependents,
  devdependencies: IcoDevDependencies,
  'download-size': IcoDownloadSize,
  downloads: IcoDownloads,
  'package-json': IcoPackageJson,
  stargazers: IcoStargazers,
};

export const Di = ({icon, title, description}) => (
  <DiBox>
    {icon && <img src={icons[icon]} alt={``} />}
    <dt>{title}</dt>
    <span />
    <dd>{description}</dd>
  </DiBox>
);

// function setHead({ name, description }) {
//   const head = document.querySelector('head');
//   const permalink = `https://yarnpkg.com${packageLink(name)}`;
//   head.querySelector('meta[property="og:title"]').setAttribute('content', name);
//   document.title = `${name} | Yarn`;
//   head
//     .querySelector('meta[name=description]')
//     .setAttribute('content', description);
//   head
//     .querySelector('meta[property="og:description"]')
//     .setAttribute('content', description);
//   head
//     .querySelector('meta[property="og:url"]')
//     .setAttribute('content', permalink);
//   head.querySelector('link[rel=canonical]').setAttribute('href', permalink);
// }

const OBJECT_DOESNT_EXIST = `ObjectID does not exist`;

const DetailsContainer = styled(Container)`
  color: #5a5a5a;

  &:after {
    display: block;
    content: "";
    clear: both;
  }

  p {
    margin: .5rem 0;
  }
`;

const DetailsMain = styled.section`
  width: 100%;
  ${ifDesktop} {
    width: calc(100% * 2 / 3);
    padding: 0 15px;
  }
`;

const Section = styled.section`
  margin: 2em;
  margin-right: 0;

  code {
    padding: .2rem .4rem;
    font-size: 90%;
    color: #bd4147;
    background-color: #f7f7f9;
    border-radius: .25rem;
  }

  pre code {
    padding: 0;
    font-size: inherit;
    color: inherit;
    background-color: transparent;
    border-radius: 0;
  }
`;

const SectionTitle = styled.h3`
  display: inline-block;
  color: #666;
  border-bottom: dotted 1px;
  position: relative;
  padding-top: .25rem;
  padding-bottom: .25rem;
  margin-top: 0;
  margin-bottom: .5rem;
  font-weight: 600;
  line-height: 1.1;
  font-size: 1.75rem;
  a {
    color: inherit;
  }
  &:before {
    content: '';
    position: absolute;
    left: -1em;
    top: 0.4em;
    width: 0.95em;
    height: 0.95em;
    background-repeat: no-repeat;
    background-size: contain;
    background-image: url(${({icon}) => icon});
  }
`;

export class Details extends Component {
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
        try {
          this.setState(prevState => ({...content, loaded: true}));
          // setHead(content);
          this.getDocuments();

          // Fetch vulnerability information
          this.getVulns(this.state.name, this.state.version);

          // Opens the file browser if the search has a 'files' param.
          const {files} = qs.parse(window.location.search, {
            ignoreQueryPrefix: true,
          });

          if (files !== undefined) {
            this.setState({isBrowsingFiles: true});
          }
        } catch (e) {
          console.error(e.stack);
        }
      })
      .catch(e => {
        if (e.message === OBJECT_DOESNT_EXIST) {
          this.setState({
            objectDoesntExist: true,
          });
        }
      });

    window.addEventListener(`popstate`, this._onPopState);
  }

  componentWillUnmount() {
    window.removeEventListener(`popstate`, this._onPopState);
  }

  getVulns(libname, version) {
    return get({
      url: `https://snyk-widget.herokuapp.com/test/npm/lib/${libname}/${version}`,
      type: `json`,
      headers: {Authorization: `uW9r=yW=J8*Ws+8MbTn8gW#UUxgzvyWyUHWQcc^c`},
    })
      .then(res => {
        this.setState({[`vulns`]: res.vulns, [`vulnsUrl`]: res.url});
      })
      .catch(err => {
        if (err === `retry`) {
          setTimeout(this.getVulns(libname, version), 200);
        }
      });
  }

  getGithub({url, state}) {
    return get({
      url: `https://api.github.com/${url}`,
      type: `json`,
    })
      .then(res => this.setState({[state]: res}))
      .catch(err => {
        if (err === `retry`) {
          setTimeout(this.getGithub({url, state}), 200);
        }
      });
  }

  // Get repository details, like stars, changelog, commit activity and so on
  getRepositoryDetails({user, project, host, branch, path}) {
    const {readme, changelogFilename} = this.state;
    const hasReadme =
      readme && readme.length > 0 && readme !== readmeErrorMessage;

    if (host === `github.com`) {
      if (changelogFilename) {
        get({
          url: changelogFilename,
          type: `text`,
        }).then(res => {
          this.setState({changelog: res});
        });
      }

      if (!hasReadme) {
        this.setState({readmeLoading: true});
        get({
          url: prefixURL(`README.md`, {
            base: `https://raw.githubusercontent.com`,
            user,
            project,
            head: branch,
            path: path.replace(/\/tree\//, ``),
          }),
          type: `text`,
        })
          .then(res => this.setState({readme: res}))
          .catch(() => this.setState({readmeLoading: false}));
      }

      this.getGithub({
        url: `repos/${user}/${project}/stats/commit_activity`,
        state: `activity`,
      });

      this.getGithub({
        url: `repos/${user}/${project}`,
        state: `github`,
      });
    } else if (host === `gitlab.com`) {
      const getGitlabFile = ({user, project, branch, filePath}) => {
        // We need to use the GitLab API because the raw url does not support cors
        // https://gitlab.com/gitlab-org/gitlab-ce/issues/25736
        // So we need to 'translate' raw urls to api urls.
        // E.g (https://gitlab.com/janslow/gitlab-fetch/raw/master/CHANGELOG.md) -> (https://gitlab.com/api/v4/projects/janslow%2Fgitlab-fetch/repository/files/CHANGELOG.md?ref=master)
        // Once gitlab adds support, we can get rid of this workaround.
        const apiUrl = `https://gitlab.com/api/v4/projects/${user}%2F${project}/repository/files/${encodeURIComponent(
          filePath,
        )}?ref=${branch}`;
        return get({
          url: apiUrl,
          type: `json`,
        }).then(res => res.encoding === `base64` && atob(res.content));
      };

      get({
        url: `https://gitlab.com/api/v4/projects/${user}%2F${project}`,
        type: `json`,
      }).then(res => this.setState({gitlab: res}));

      // Fetch last commit
      get({
        url: `https://gitlab.com/api/v4/projects/${user}%2F${project}/repository/commits?per_page=1`,
        type: `json`,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      }).then(([{committed_date}]) => {
        const timeDistance = formatDistance(new Date(committed_date), new Date());
        this.setState({
          activity: {
            lastCommit: `${timeDistance} ago`,
          },
        });
      });

      if (!hasReadme) {
        this.setState({readmeLoading: true});

        getGitlabFile({
          user,
          project,
          branch,
          filePath: `${path}/README.md`,
        })
          .then(res => this.setState({readme: res}))
          .catch(() => this.setState({readmeLoading: false}));
      }

      if (changelogFilename) {
        // Extract information from raw url
        // See comment in getGitlabFile
        const [, user, project, branch, filePath] = changelogFilename.match(
          /^https?:\/\/gitlab.com\/([^/]+)\/([^/]+)\/raw\/([^/]+)\/(.*)$/i,
        );

        getGitlabFile({user, project, branch, filePath}).then(res =>
          this.setState({changelog: res}),
        );
      }
    } else if (host === `bitbucket.org`) {
      if (!hasReadme) {
        this.setState({readmeLoading: true});

        get({
          url: `https://bitbucket.org/${user}/${project}${
            path ? path.replace(`src`, `raw`) : `/raw/${branch}`
          }/README.md`,
          type: `text`,
          redirect: `error`, // Prevent being redirected to login page
        })
          .then(res => this.setState({changelog: res}))
          .catch(() => this.setState({readmeLoading: false}));
      }

      // Fetch last commit
      get({
        url: `https://api.bitbucket.org/2.0/repositories/${user}/${project}/commits?pagelen=1`,
        type: `json`,
      }).then(({values: [{date}]}) => {
        const timeDistance = formatDistance(new Date(date), new Date());
        this.setState({
          activity: {
            lastCommit: `${timeDistance} ago`,
          },
        });
      });

      if (changelogFilename) {
        get({
          url: changelogFilename,
          type: `text`,
          redirect: `error`, // Prevent being redirected to login page
        }).then(res => this.setState({changelog: res}));
      }
    }
  }

  getDocuments() {
    const {repository, name, version} = this.state;

    if (repository && repository.host)
      this.getRepositoryDetails(repository);


    get({
      url: `https://bundlephobia.com/api/size?package=${name}@${version}`,
      type: `json`,
    }).then(res => {
      if (typeof res === `object`) {
        this.setState({
          bundlesize: {
            href: `https://bundlephobia.com/result?p=${name}@${version}`,
            size: bytes(res.size),
            gzip: bytes(res.gzip),
          },
        });
      }
    });
  }

  maybeRenderReadme() {
    if (this.state.loaded) {
      const {readmeLoading, readme = ``} = this.state;
      if (readme.length === 0 || readme === readmeErrorMessage) {
        // Still loading
        if (readmeLoading)
          return null;

        return <div>no readme found <span role={`img`} aria-label={`sad emotion`}>😢</span></div>;
      }
      return (
        <ReadMore text={`Display full readme`}>
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
    if (this.state.isBrowsingFiles)
      return this._renderFileBrowser();

    if (this.state.objectDoesntExist)
      return this._renderInvalidPackage();

    return this._renderDetails();
  }

  _renderInvalidPackage() {
    return (
      <InvalidPackage>
        <h2>
          {`Whoa, ${this.props.objectID} does not exist yet`}
        </h2>
        <p>But that means it is now yours!</p>
        <Instructions>
          <Copyable pre={`$ `}>mkdir {this.props.objectID}</Copyable>
          <Copyable pre={`$ `}>cd {this.props.objectID}</Copyable>
          <Copyable pre={`$ `}>yarn init -2</Copyable>
          <p>Make your package</p>
          <Copyable pre={`$ `}>yarn npm publish</Copyable>
        </Instructions>
      </InvalidPackage>
    );
  }

  _renderDetails() {
    return (
      <DetailsContainer>
        <DetailsMain>
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
            types={this.state.types}
            vulns={this.state.vulns}
            vulnsUrl={this.state.vulnsUrl}
          />
          <Section id={`readme`}>
            <SectionTitle icon={IcoReadme}>
              <a href={`#readme`}>readme</a>
            </SectionTitle>
            {this.maybeRenderReadme()}
          </Section>
          {this.state.changelog && (
            <Section id={`changelog`}>
              <SectionTitle icon={IcoChangelog}>
                <a href={`#changelog`}>changelog</a>
              </SectionTitle>
              <ReadMore text={`Display full changelog`}>
                <Markdown
                  source={this.state.changelog}
                  repository={this.state.repository}
                />
              </ReadMore>
            </Section>
          )}
        </DetailsMain>

        {this._renderSidebar()}

        <JSONLDItem
          name={this.state.name}
          description={this.state.description}
          keywords={this.state.keywords}
        />
      </DetailsContainer>
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
      <Container>
        <FileBrowserColumn>
          <FileBrowser
            objectID={this.props.objectID}
            version={this.state.version}
            onBackToDetails={this._closeFileBrowser}
          />
        </FileBrowserColumn>
        {this._renderSidebar()}
      </Container>
    );
  }

  _getRepositoryStarCount = () => {
    const {github, gitlab, repository} = this.state;

    if (
      !repository ||
      !repository.host ||
      repository.host === `bitbucket.org`
    )
      return -1;


    if (repository.host === `github.com` && github)
      return this.state.github.stargazers_count;

    if (repository.host === `gitlab.com` && gitlab)
      return this.state.gitlab.star_count;

    return 0;
  };

  _openFileBrowser = evt => {
    // Ignore if is already browsing the files (prevent pushing state to the history repeatedly)
    if (!this.state.isBrowsingFiles) {
      this._setFilesSearchParam(true);

      this.setState({isBrowsingFiles: true});
    }
    evt.preventDefault();
  };

  _closeFileBrowser = evt => {
    this._setFilesSearchParam(false);

    this.setState({isBrowsingFiles: false});
    evt.preventDefault();
  };

  // Add/remove the 'files' param from the search (push to the history)
  _setFilesSearchParam = active => {
    // The strictNullHandling option is used to avoid that the qs includes a '=' at the end of empty params
    const search = qs.parse(window.location.search, {
      ignoreQueryPrefix: true,
      strictNullHandling: true,
    });

    if (active)
      search.files = null;
    else
      delete search.files;


    window.history.pushState(
      null,
      null,
      window.location.pathname +
        qs.stringify(search, {addQueryPrefix: true, strictNullHandling: true}),
    );
  };

  _onPopState = ({state}) => {
    // Open or close the file browser based on the current search
    const {files} = qs.parse(window.location.search, {ignoreQueryPrefix: true});

    if (files !== undefined) {
      this.setState({isBrowsingFiles: true});
    } else if (this.state.isBrowsingFiles) {
      this.setState({isBrowsingFiles: false});
    }
  };
}
