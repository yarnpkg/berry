import React                   from 'react';

import {isKnownRepositoryHost} from '../util';

import {Di}                    from './';

const Stargazers = ({stargazers, repository}) => {
  if (
    stargazers < 0 ||
    !repository ||
    !isKnownRepositoryHost(repository.host)
  )
    return null;

  const [provider] = repository.host.split(`.`);
  const providerName = {github: `GitHub`, gitlab: `GitLab`}[provider];
  return (
    <Di
      icon={`stargazers`}
      title={`${providerName} stargazers`}
      description={stargazers.toLocaleString(`en`)}
    />
  );
};

const Downloads = ({downloads, humanDownloads}) =>
  downloads >= 0 &&
  humanDownloads && (
    <Di
      icon={`downloads`}
      title={`Downloads last 30 days`}
      description={
        <span title={downloads.toLocaleString(`en`)}>
          {humanDownloads}
        </span>
      }
    />
  );

const Dependents = ({dependents, humanDependents, name}) =>
  dependents >= 0 && (
    <Di
      icon={`dependents`}
      title={`Dependents`}
      description={
        <a
          href={`https://www.npmjs.com/browse/depended/${name}`}
          target={`_blank`}
          rel={`noopener noreferrer`}
          title={dependents.toLocaleString(`en`)}
        >
          {humanDependents}
        </a>
      }
    />
  );

const formatHits = hits => {
  if (hits >= 1e9)
    return `${Math.round(hits / 1e7) / 100}b`;
  else if (hits >= 1e6)
    return `${Math.round(hits / 1e4) / 100}m`;
  else if (hits >= 1000)
    return `${Math.round(hits / 10) / 100}k`;


  return hits;
};

const JsDelivrHits = ({jsDelivrHits}) => (<Di
  icon={`downloads`}
  title={`jsDelivr last 30 days`}
  description={
    <span title={jsDelivrHits.toLocaleString(`en`)}>
      {formatHits(jsDelivrHits)}
    </span>
  }
/>);

export const Popularity = ({name, stargazers, repository,
  downloads, humanDownloads, dependents, humanDependents, jsDelivrHits}) => {
  if (downloads >= 0 || dependents >= 0 || stargazers >= 0 || jsDelivrHits >= 0) {
    return (
      <article>
        <h1>Popularity</h1>
        <dl>
          <Stargazers repository={repository} stargazers={stargazers} />
          <Downloads downloads={downloads} humanDownloads={humanDownloads} />
          <JsDelivrHits jsDelivrHits={jsDelivrHits} />
          <Dependents
            dependents={dependents}
            humanDependents={humanDependents}
            name={name}
          />
        </dl>
      </article>
    );
  } else {
    return null;
  }
};
