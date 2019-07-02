import React from 'react';

import Install from './Install';
import Cdn from './Cdn';
import Links from './Links';
import Activity from './Activity';
import Popularity from './Popularity';
import Usage from './Usage';
import Versions from './Versions';
import Contributors from './Contributors';
import Tags from './Tags';
import { packageJSONLink, isKnownRepositoryHost } from '../util';
import GithubActivity from './GithubActivity';

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
  <aside className="details-side col-lg-4">
    <article className="details-side--links">
      <Links name={name} homepage={homepage} repository={repository} />
    </article>
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
  </aside>
);

export default Aside;
