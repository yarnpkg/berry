import React                          from 'react';

import {ConfigurationLayout}          from '../../components/layout-configuration';
import {SEO, defaultKeywords}         from '../../components/seo';

import {convertSchemaToConfiguration} from '../../utils/schemaUtils';

import manifestSchema                 from './manifest.json';


const PackageJsonDoc = () => <>
  <ConfigurationLayout>
    <SEO
      title={`Manifest fields`}
      description={`List of all the supported fields for a Yarn project manifest (package.json files)`}
      keywords={defaultKeywords}
    />
    {convertSchemaToConfiguration(manifestSchema, `Json`)}
  </ConfigurationLayout>
</>;

// eslint-disable-next-line arca/no-default-export
export default PackageJsonDoc;
