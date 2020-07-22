import styled                                  from '@emotion/styled';
import React                                   from 'react';

import {License, Deprecated, Owner, Downloads, TypeScript} from '../hit';
import {Keywords, safeMarkdown}                from '../util';
import IcoSnyk                                 from '../../images/detail/ico-snyk.svg';

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

const VulnLink = styled.a`
  font-size: 0.825rem;
  color: rgba(0,0,0,0.5);
  letter-spacing: 0.3px;
  margin-left: 8px;
`;

const VulnIcon = styled.img`
  position: relative;
  top: -2px;
  vertical-align: middle;
  border-style: none;
`;

const Vulnerabilities = ({vulns, url}) =>
  vulns !== undefined ? (
    <VulnLink
      href={url}
    >
      <VulnIcon
        width="22"
        height="22"
        alt="vulns"
        src={IcoSnyk}
      />
      {vulns} vulnerabilities
    </VulnLink>
  ) : null;

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
  types,
  vulns,
  vulnsUrl,
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
      <TypeScript ts={types.ts} />
      <Vulnerabilities vulns={vulns} url={vulnsUrl} />
    </PackageInfo>
    <Description description={description} deprecated={deprecated} />
    <Keywords keywords={keywords} />
  </header>
);
