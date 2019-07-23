import React                                      from 'react';
import styled                                     from '@emotion/styled';

import Install                                    from './Install';
import Cdn                                        from './Cdn';
import Links                                      from './Links';
import Activity                                   from './Activity';
import Popularity                                 from './Popularity';
import Usage                                      from './Usage';
import Versions                                   from './Versions';
import Contributors                               from './Contributors';
import Tags                                       from './Tags';
import { packageJSONLink, isKnownRepositoryHost } from '../util';
import GithubActivity                             from './GithubActivity';

const AsideContainer = styled.aside`
  border-left: 1px solid #cbcbcb;
  float: left;
  width: 33.3333333333%;
  padding: 0 15px;
`;

const DetailsLinks = styled.article`
  margin-bottom: 2em;
`;

const Aside = ({
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

export default Aside;
