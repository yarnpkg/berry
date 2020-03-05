import React                          from 'react';

import {ConfigurationLayout}          from '../../components/layout-configuration';
import {SEO, defaultKeywords}         from '../../components/seo';

import {convertSchemaToConfiguration} from '../../utils/schemaUtils';

import yarnrcSchema                   from './yarnrc.json';


const YarnrcDoc = () => <>
  <ConfigurationLayout>
    <SEO
      title={`Configuration options`}
      description={`List of all the configuration option for Yarn (yarnrc files)`}
      keywords={defaultKeywords}
    />
    {convertSchemaToConfiguration(yarnrcSchema)}
  </ConfigurationLayout>
</>;

// eslint-disable-next-line arca/no-default-export
export default YarnrcDoc;
