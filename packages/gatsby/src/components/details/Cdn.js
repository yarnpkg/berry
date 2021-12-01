import styled from '@emotion/styled';
import React  from 'react';

import {Di}   from './';

const CdnBox = styled.article`
  h1 {
    color: #5a5a5a;
    margin-top: 0;
    margin-bottom: .5rem;
    font-weight: 600;
    font-size: 1.2em;
    line-height: 1.1;
  }
`;

const JsDelivr = ({name, version}) => (
  <Di
    title={`jsDelivr`}
    description={
      <a
        href={`https://cdn.jsdelivr.net/npm/${name}@${version}/`}
        target={`_blank`}
        rel={`noopener noreferrer`}
      >
        cdn.jsdelivr.net/npm/{name}/
      </a>
    }
  />
);

const Unpkg = ({name, version}) => (
  <Di
    title={`unpkg`}
    description={
      <a
        href={`https://unpkg.com/${name}@${version}/`}
        target={`_blank`}
        rel={`noopener noreferrer`}
      >
        unpkg.com/{name}/
      </a>
    }
  />
);

const BundleRun = ({name, version}) => (
  <Di
    title={`bundle.run`}
    description={
      <a
        href={`https://bundle.run/${name}@${version}`}
        target={`_blank`}
        rel={`noopener noreferrer`}
      >
        bundle.run/{name}
      </a>
    }
  />
);

export const Cdn = ({name, version}) => {
  const cdns = {
    jsdelivr: JsDelivr,
    unpkg: Unpkg,
    bundlerun: BundleRun,
  };

  const order = Object.keys(cdns).sort(() => Math.random() - 0.5);

  const items = order.map(key => {
    const Component = cdns[key];
    return (
      <Component
        key={key}
        name={name}
        version={version}
      />
    );
  });

  return (
    <CdnBox>
      <h1>CDNs</h1>
      <dl>{items}</dl>
    </CdnBox>
  );
};
