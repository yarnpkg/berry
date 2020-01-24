import styled                                  from '@emotion/styled';
import React                                   from 'react';

import {License, Deprecated, Owner, Downloads} from '../hit';
import {Keywords, safeMarkdown}                from '../util';

const DescriptionText = styled.p`
  font-size: 1.25rem;
  font-weight: 300;
`;

const DeprecatedText = styled.p``;

const Description = ({description, deprecated}) => (
  <div>
    {deprecated ? (
      <DeprecatedText>
        <strong dangerouslySetInnerHTML={safeMarkdown(deprecated)} />
      </DeprecatedText>
    ) : null}
    <DescriptionText
      dangerouslySetInnerHTML={safeMarkdown(description)}
    />
  </div>
);

const PackageTitle = styled.h2`
  margin: .5rem .5rem .5rem 0;
  display: inline-block;
  font-weight: 600;
  line-height: 1.1;
  font-size: 2rem;
`;

const PackageInfo = styled.div`
  display: inline-block;
  line-height: 2.2rem;
  margin: .5rem;
  position: relative;
`;

export const Header = ({
  name,
  owner,
  downloadsLast30Days,
  humanDownloadsLast30Days,
  description,
  license,
  deprecated,
  keywords,
  version,
}) => (
  <header>
    <PackageTitle>{name}</PackageTitle>
    <PackageInfo>
      <Owner {...owner} />
      <Downloads
        downloads={downloadsLast30Days}
        humanDownloads={humanDownloadsLast30Days}
      />
      <License type={license} />
      <Deprecated deprecated={deprecated} />
      <span>{version}</span>
    </PackageInfo>
    <Description description={description} deprecated={deprecated} />
    <Keywords keywords={keywords} />
  </header>
);
