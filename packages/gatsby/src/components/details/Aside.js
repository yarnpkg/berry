import styled                                   from '@emotion/styled';
import React                                    from 'react';

import {ifDesktop}                              from '../responsive';

import {packageJSONLink, isKnownRepositoryHost} from '../util';

import {Activity}                               from './Activity';
import {Cdn}                                    from './Cdn';
import {Contributors}                           from './Contributors';
import {GithubActivity}                         from './GithubActivity';
import {Install}                                from './Install';
import {Links}                                  from './Links';
import {Popularity}                             from './Popularity';
import {Tags}                                   from './Tags';
import {Usage}                                  from './Usage';
import {Versions}                               from './Versions';

const AsideContainer = styled.aside`
  ${ifDesktop} {
    border-left: 1px solid #cbcbcb;
    width: calc(100% / 3);
    padding: 0 15px;
  }
`;

const DetailsLinks = styled.article`
  margin-bottom: 2em;
`;

export const Aside = ({
  name,
  homepage,
  repository,
  contributors,
  activity,
  downloads,
  humanDownloads,
  stargazers,
  dependents,
  humanDependents,
  dependencies,
  tags,
  versions,
  version,
  devDependencies,
  bundlesize,
  onOpenFileBrowser,
  jsDelivrHits,
}) => (
  <AsideContainer>
    <DetailsLinks>
      <Links name={name} homepage={homepage} repository={repository} />
    </DetailsLinks>
    <Install name={name} onOpenFileBrowser={onOpenFileBrowser} />
    <Cdn name={name} version={version} />
    <Popularity
      repository={repository}
      downloads={downloads}
      humanDownloads={humanDownloads}
      stargazers={stargazers}
      dependents={dependents}
      humanDependents={humanDependents}
      name={name}
      jsDelivrHits={jsDelivrHits}
    />
    {repository &&
      isKnownRepositoryHost(repository.host) &&
      (repository.host === 'github.com' ? (
        <GithubActivity data={activity} repository={repository} />
      ) : (
        <Activity {...activity} repository={repository} />
      ))}
    <Usage
      dependencies={dependencies}
      devDependencies={devDependencies}
      bundlesize={bundlesize}
      {...packageJSONLink(name)}
    />
    <Tags tags={tags} name={name} />
    <Versions versions={versions} />
    <Contributors contributors={contributors} />
  </AsideContainer>
);
