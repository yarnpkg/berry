import React from 'react';

import { encode, isKnownRepositoryHost } from '../util';
import Copyable from './Copyable';

const images = {
  homepage: '/assets/search/ico-home.svg',
  npm: '/assets/search/ico-npm.svg',
  github: '/assets/search/ico-github.svg',
  yarn: '/assets/search/ico-yarn.svg',
  gitlab: '/assets/search/ico-gitlab.svg',
  bitbucket: '/assets/search/ico-bitbucket.svg',
  generic_repo: '/assets/search/ico-git.svg',
};

export const Link = ({ site, url, display, Tag = 'a' }) => (
  <Tag
    href={url}
    className={`details-links--link details-links--link__${site}`}
  >
    <img src={images[site]} alt="" />
    {display}
  </Tag>
);

const RepositoryLink = ({ repository }) => {
  const { host, user, path, project } = repository;

  if (!isKnownRepositoryHost(repository.host)) {
    return repository.url ? (
      <Link site="generic_repo" url={repository.url} display={repository.url} />
    ) : null;
  }

  const [provider] = repository.host.split('.');

  return (
    <Link
      site={provider}
      url={`https://${host}/${encode(user)}/${encode(project)}${path || ''}`}
      display={`${user}/${project}`}
    />
  );
};

const Links = ({ name, homepage, repository, className }) => (
  <div className="detail-links">
    <Link
      site="yarn"
      display={
        <Copyable>
          <a href={`https://yarn.pm/${name}`}>
            <span className="text-hide">https://</span>
            yarn.pm/{name}
          </a>
        </Copyable>
      }
      Tag="div"
    />
    {homepage ? (
      <Link
        site="homepage"
        url={homepage}
        display={homepage.replace(/(http)?s?(:\/\/)?(www\.)?/, '')}
      />
    ) : null}
    {repository ? <RepositoryLink repository={repository} /> : null}
    <Link
      site="npm"
      url={`https://www.npmjs.com/package/${name}`}
      display={name}
    />
  </div>
);

export default Links;
