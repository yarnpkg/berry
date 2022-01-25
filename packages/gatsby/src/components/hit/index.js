import styled         from '@emotion/styled';
import formatDistance from 'date-fns/formatDistance';
import {Link}         from 'gatsby';
import {Highlight}    from 'react-instantsearch-dom';
import React          from 'react';

import IcoBitBucket   from '../../images/search/ico-bitbucket.svg';
import IcoDownload    from '../../images/search/ico-download.svg';
import IcoGitHub      from '../../images/search/ico-github.svg';
import IcoGitLab      from '../../images/search/ico-gitlab.svg';
import IcoHome        from '../../images/search/ico-home.svg';
import IcoHotT1       from '../../images/search/ico-hot-t1.svg';
import IcoHotT2       from '../../images/search/ico-hot-t2.svg';
import IcoHotT3       from '../../images/search/ico-hot-t3.svg';
import IcoHotT4       from '../../images/search/ico-hot-t4.svg';
import IcoNpm         from '../../images/search/ico-npm.svg';

import {
  getDownloadBucket,
  formatKeywords,
  encode,
  packageLink,
  isEmpty,
  HighlightedMarkdown,
  isKnownRepositoryHost,
} from '../util';

const HitLicense = styled.span`
  font-size: 0.75rem;
  border: solid 1px #ccc;
  color: rgba(0,0,0,0.5);
  padding: 2px 4px;
  border-radius: 4px;
  margin-right: 8px;
  letter-spacing: 0.2px;
`;

export const License = ({type}) =>
  type ? <HitLicense>{type}</HitLicense> : null;

const HitDeprecated = styled.span`
  font-size: 0.75rem;
  text-transform: uppercase;
  background-color: #ccc;
  border: solid 1px #ccc;
  color: white;
  padding: 2px 4px;
  border-radius: 4px;
  margin-right: 8px;
  letter-spacing: 0.2px;
`;

export const Deprecated = ({deprecated}) =>
  deprecated ? (
    <HitDeprecated title={deprecated}>
      deprecated
    </HitDeprecated>
  ) : null;

const HitOwnerLink = styled.a`
  font-size: 0.69rem;
  font-weight: bold;
  color: rgba(0,0,0,0.7);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-right: 8px;
`;

const HitOwnerAvatar = styled.img`
  border-radius: 4px;
  margin-right: 4px;
  position: relative;
  top: -2px;
  vertical-align: middle;
  border-style: none;
`;

export const Owner = ({link, avatar, name, onClick}) => (
  <HitOwnerLink
    href={link}
    onClick={e => {
      if (onClick && !(e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onClick(name);
      }
    }}
  >
    <HitOwnerAvatar
      width={`20`}
      height={`20`}
      alt={`owner`}
      src={`https://res.cloudinary.com/hilnmyskv/image/fetch/w_40,h_40,f_auto,q_80,fl_lossy/${avatar}`}
    />
    {name}
  </HitOwnerLink>
);

const HitPopular = styled.span`
  font-size: 0.825rem;
  color: rgba(0,0,0,0.5);
  margin-right: 8px;
  text-transform: uppercase;
  &:before {
    position: relative;
    display: inline-block;
    content: '';
    background-position: bottom center;
    background-repeat: no-repeat;
    background-image: url(${IcoDownload});
    width: 15px;
    height: 20px;
    margin-right: 3px;
    top: 2px;
  }
  &.hot-t1:before {
    background-image: url(${IcoHotT1});
  }
  &.hot-t2:before {
    background-image: url(${IcoHotT2});
  }
  &.hot-t3:before {
    background-image: url(${IcoHotT3});
  }
  &.hot-t4:before {
    background-image: url(${IcoHotT4});
  }
`;

export const Downloads = ({downloads = 0, humanDownloads}) => (
  <HitPopular
    className={`${getDownloadBucket(downloads)}`}
    title={`${downloads.toLocaleString(`en`)} downloads in the last 30 days`}
  >
    {humanDownloads}
  </HitPopular>
);

const HitLinkList = styled.div`
  position: absolute;
  top: calc(50% - 12px);
  right: 1rem;
`;

const HitLink = styled.a`
  display: block;
  opacity: 0.5;
  text-indent: -9000px;
  height: 100%;
  background-position: center;
  background-repeat: no-repeat;
  margin-left: 0.8em;
  float: right;
`;

const HitLinkNpm = styled(HitLink)`
  background-image: url(${IcoNpm});
  width: 34px;
  height: 26px;
`;

const HitLinkHomepage = styled(HitLink)`
  background-image: url(${IcoHome});
  width: 26px;
  height: 26px;
`;

const RepoIcons = {
  github: IcoGitHub,
  gitlab: IcoGitLab,
  bitbucket: IcoBitBucket,
};

const HitRepoLink = styled(HitLink)`
  background-image: url(${props => RepoIcons[props.provider]});
  width: 26px;
  height: 26px;
`;

const Repository = ({repository, name}) => {
  const [provider] = repository.host.split(`.`);

  return (
    <HitRepoLink
      provider={provider}
      title={`${provider} repository of ${name}`}
      href={`https://${repository.host}/${encode(repository.user)}/${encode(
        repository.project,
      )}${repository.path || ``}`}
    >
      {provider}
    </HitRepoLink>
  );
};

export const Links = ({name, homepage, repository}) => (
  <HitLinkList>
    <HitLinkNpm
      href={`https://www.npmjs.com/package/${name}`}
      title={`npm page for ${name}`}
    >
      npm
    </HitLinkNpm>
    {repository && isKnownRepositoryHost(repository.host) ? (
      <Repository name={name} repository={repository} />
    ) : null}
    {homepage ? (
      <HitLinkHomepage title={`Homepage of ${name}`} href={homepage}>
        Homepage
      </HitLinkHomepage>
    ) : null}
  </HitLinkList>
);

const HitItem = styled.div`
  padding: 1.5rem 0 2rem;
  border-bottom: 1px solid #eceeef;
  position: relative;
`;

const HitNameLink = styled(Link)`
  &:hover, &:visited, &:focus {
    text-decoration: none;
    color: rgba(0,0,0,0.9);
  }
  font-size: 1.625rem;
  font-weight: normal;
  color: rgba(0,0,0,0.7);
  margin-right: 8px;
  position: relative;
  top: 2px;
  em {
    border-bottom: dotted 1px;
    font-style: normal;
  }
`;

const HitVersion = styled.span`
  font-size: 0.825rem;
  color: rgba(0,0,0,0.5);
  font-weight: bold;
  max-width: 90px;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  display: inline-block;
  vertical-align: middle;
`;

const HitTypeScript = styled.span`
  font-size: 0.75rem;
  border: solid 1px transparent;
  color: #ffffff;
  padding: 2px 4px;
  border-radius: 4px;
  margin-right: 8px;
  letter-spacing: 0.2px;
  background: #0380d9;
`;

export const TypeScript = ({name, ts}) => {
  if (ts === false)
    return null;

  const iconTypescript = <HitTypeScript
    alt={`TypeScript support: ${ts}`}
    title={`TypeScript support: ${ts}`}
    children={ts === `definitely-typed` ? `DT` : `TS`}
  />;

  if (ts !== `definitely-typed`)
    return iconTypescript;

  const [, identScope, indentName] = /^(?:@([^/]+?)\/)?([^/]+)$/.exec(name);

  const typesIdentName = identScope
    ? `${identScope}__${indentName}`
    : indentName;

  return (
    <a href={`/package/@types/${typesIdentName}`}>
      {iconTypescript}
    </a>
  );
};

const HitDescription = styled.p`
  font-size: 0.875rem;
  color: rgba(0,0,0,0.5);
  margin: 0.6rem 0;

  em {
    font-style: italic;
    border-bottom: dotted 1px;
  }
`;

const HitLastUpdate = styled.span`
  font-size: 0.825rem;
  color: rgba(0,0,0,0.5);
  font-style: italic;
`;

const HitHiddenKeywords = styled.span`
  display: none !important;
`;

export const Hit = ({hit, onTagClick, onOwnerClick, searchState}) => (
  <HitItem>
    <HitNameLink to={packageLink(hit.name, false)}>
      <Highlight attribute={`name`} hit={hit} />
    </HitNameLink>
    <Downloads
      downloads={hit.downloadsLast30Days}
      humanDownloads={hit.humanDownloadsLast30Days}
    />
    <License type={hit.license} />
    <Deprecated deprecated={hit.deprecated} />
    <TypeScript name={hit.name} ts={hit.types.ts} />
    <HitVersion>{hit.version}</HitVersion>
    <HitDescription>
      {hit.deprecated ? (
        hit.deprecated
      ) : (
        <HighlightedMarkdown attribute={`description`} hit={hit} />
      )}
    </HitDescription>
    <Owner {...hit.owner} onClick={onOwnerClick} />
    <HitLastUpdate
      title={`last updated ${new Date(hit.modified).toLocaleDateString(`en`)}`}
    >
      {`{time_distance} ago`.replace(
        `{time_distance}`,
        formatDistance(new Date(hit.modified), new Date()),
      )}
    </HitLastUpdate>
    {isEmpty(hit.keywords) ? null : (
      <HitHiddenKeywords>
        {formatKeywords(
          hit.keywords,
          hit._highlightResult.keywords,
          4,
          onTagClick,
        )}
      </HitHiddenKeywords>
    )}
    <Links
      name={hit.name}
      homepage={hit.homepage}
      repository={hit.repository}
    />
  </HitItem>
);
