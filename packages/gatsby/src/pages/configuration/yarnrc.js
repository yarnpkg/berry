import React                          from 'react';

import yarnrcSchema                   from '../../../static/configuration/yarnrc.json';
import {ConfigurationLayout}          from '../../components/layout-configuration';

import {SEO, defaultKeywords}         from '../../components/seo';

import {convertSchemaToConfiguration} from '../../utils/schemaUtils';

const configuration = convertSchemaToConfiguration(yarnrcSchema, `Syml`);

const YarnrcDoc = () => <>
  <ConfigurationLayout>
    <SEO
      title={`Configuration options`}
      description={`List of all the configuration option for Yarn (yarnrc files)`}
      keywords={defaultKeywords}
    />
    {configuration}
  </ConfigurationLayout>
</>;

// eslint-disable-next-line arca/no-default-export
export default YarnrcDoc;
