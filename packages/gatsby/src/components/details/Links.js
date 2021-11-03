import styled                          from '@emotion/styled';
import React                           from 'react';

import IcoBitbucket                    from '../../images/search/ico-bitbucket.svg';
import IcoGit                          from '../../images/search/ico-git.svg';
import IcoGithub                       from '../../images/search/ico-github.svg';
import IcoGitlab                       from '../../images/search/ico-gitlab.svg';
import IcoHome                         from '../../images/search/ico-home.svg';
import IcoNpm                          from '../../images/search/ico-npm.svg';
import IcoYarn                         from '../../images/search/ico-yarn.svg';
import {encode, isKnownRepositoryHost} from '../util';

import {Copyable}                      from './Copyable';

const images = {
  homepage: IcoHome,
  npm: IcoNpm,
  github: IcoGithub,
  yarn: IcoYarn,
  gitlab: IcoGitlab,
  bitbucket: IcoBitbucket,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  generic_repo: IcoGit,
};

const LinkIcon = styled.img`
  margin-right: 0.2em;
  height: 1em;
  width: 2em;
  opacity: 0.5;
  vertical-align: middle;
  border-style: none;
`;

const LinkBox = styled.span`
  a:hover {
    color: #0a4a67;
    text-decoration: underline;
  }
`;

export const Link = ({site, url, display, tag = `a`}) => {
  const LinkElement = styled(tag)`
    display: flex;
    text-size-adjust: 100%;
    align-items: center;
    color: #666666;
    padding: 0.5em 1em;
    margin: 0.2em;
    border-radius: 0.2em;
    border: 1px solid #cbcbcb;
    font-size: 1em;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  `;

  return (
    <LinkBox>
      <LinkElement href={url}>
        {site && <LinkIcon src={images[site]} alt={``} />}
        {display}
      </LinkElement>
    </LinkBox>
  );
};

const RepositoryLink = ({repository}) => {
  const {host, user, path, project} = repository;

  if (!isKnownRepositoryHost(repository.host)) {
    return repository.url ? (
      <Link site={`generic_repo`} url={repository.url} display={repository.url} />
    ) : null;
  }

  const [provider] = repository.host.split(`.`);

  return (
    <Link
      site={provider}
      url={`https://${host}/${encode(user)}/${encode(project)}${path || ``}`}
      display={`${user}/${project}`}
    />
  );
};

export const Links = ({name, homepage, repository}) => (
  <div>
    <Link
      site={`yarn`}
      url={`https://yarn.pm/${name}`}
      display={
        <Copyable>
          <span className={`text-hide`}>https://</span>
            yarn.pm/{name}
        </Copyable>
      }
    />
    {homepage ? (
      <Link
        site={`homepage`}
        url={homepage}
        display={homepage.replace(/(http)?s?(:\/\/)?(www\.)?/, ``)}
      />
    ) : null}
    {repository ? <RepositoryLink repository={repository} /> : null}
    <Link
      site={`npm`}
      url={`https://www.npmjs.com/package/${name}`}
      display={name}
    />
  </div>
);
