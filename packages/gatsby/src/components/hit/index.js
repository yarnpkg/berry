import React           from 'react';
import formatDistance  from 'date-fns/formatDistance';
import { Highlight }   from 'react-instantsearch-dom';

import {
  getDownloadBucket,
  formatKeywords,
  encode,
  packageLink,
  isEmpty,
  HighlightedMarkdown,
  i18nReplaceVars,
  isKnownRepositoryHost,
} from '../util';

export const License = ({ type }) =>
  type ? <span className="ais-Hit-license">{type}</span> : null;

export const Deprecated = ({ deprecated }) =>
  deprecated ? (
    <span className="ais-Hit-deprecated" title={deprecated}>
      deprecated
    </span>
  ) : null;

export const Owner = ({ link, avatar, name, onClick }) => (
  <a
    className="ais-Hit-ownerLink"
    href={link}
    onClick={e => {
      if (onClick && !(e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onClick(name);
      }
    }}
  >
    <img
      width="20"
      height="20"
      className="ais-Hit-ownerAvatar"
      alt="owner"
      src={`https://res.cloudinary.com/hilnmyskv/image/fetch/w_40,h_40,f_auto,q_80,fl_lossy/${avatar}`}
    />
    {name}
  </a>
);

export const Downloads = ({ downloads = 0, humanDownloads }) => (
  <span
    className={`ais-Hit-popular ${getDownloadBucket(downloads)}`}
    title={'{count} downloads in the last 30 days'.replace(
      '{count}',
      downloads.toLocaleString('en')
    )}
  >
    {humanDownloads}
  </span>
);

const Repository = ({ repository, name }) => {
  const [provider] = repository.host.split('.');

  return (
    <span className={`ais-Hit-link-${provider}`}>
      <a
        title={i18nReplaceVars('{provider} repository of {name}', {
          provider,
          name,
        })}
        href={`https://${repository.host}/${encode(repository.user)}/${encode(
          repository.project
        )}${repository.path || ''}`}
      >
        {provider}
      </a>
    </span>
  );
};

export const Links = ({ name, homepage, repository, className }) => (
  <div className={className}>
    <span className="ais-Hit-link-npm">
      <a
        href={`https://www.npmjs.com/package/${name}`}
        title={'npm page for {name}'.replace('{name}', name)}
      >
        npm
      </a>
    </span>
    {repository && isKnownRepositoryHost(repository.host) ? (
      <Repository name={name} repository={repository} />
    ) : null}
    {homepage ? (
      <span className="ais-Hit-link-homepage">
        <a title={`Homepage of ${name}`} href={homepage}>
          Homepage
        </a>
      </span>
    ) : null}
  </div>
);

const Hit = ({ hit, onTagClick, onOwnerClick }) => (
  <div className="ais-Hits-item">
    <a className="ais-Hit-name" href={packageLink(hit.name)}>
      <Highlight attribute="name" hit={hit} />
    </a>
    <Downloads
      downloads={hit.downloadsLast30Days}
      humanDownloads={hit.humanDownloadsLast30Days}
    />
    <License type={hit.license} />
    <Deprecated deprecated={hit.deprecated} />
    <span className="ais-Hit-version">{hit.version}</span>
    <p className="ais-Hit-description">
      {hit.deprecated ? (
        hit.deprecated
      ) : (
        <HighlightedMarkdown attribute="description" hit={hit} />
      )}
    </p>
    <Owner {...hit.owner} onClick={onOwnerClick} />
    <span
      className="ais-Hit-lastUpdate"
      title={'last updated {update_date}'.replace(
        '{update_date}',
        new Date(hit.modified).toLocaleDateString('en')
      )}
    >
      {'{time_distance} ago'.replace(
        '{time_distance}',
        formatDistance(new Date(hit.modified), new Date())
      )}
    </span>
    {isEmpty(hit.keywords) ? null : (
      <span className="ais-Hit-keywords hidden-sm-down">
        {formatKeywords(
          hit.keywords,
          hit._highlightResult.keywords,
          4,
          onTagClick
        )}
      </span>
    )}
    <Links
      className="ais-Hit-links"
      name={hit.name}
      homepage={hit.homepage}
      repository={hit.repository}
    />
  </div>
);

export default Hit;
