import React                                      from 'react';

import manifestSchema                             from '../../../static/configuration/manifest.json';
import {ConfigurationLayout}                      from '../../components/layout-configuration';
import {SEO, defaultKeywords}                     from '../../components/seo';
import {convertSchemaToConfiguration, SchemaMode} from '../../utils/schemaUtils';

const configuration = convertSchemaToConfiguration(manifestSchema, {mode: SchemaMode.Json});

const PackageJsonDoc = () => <>
  <ConfigurationLayout>
    <SEO
      title={`Manifest fields`}
      description={`List of all the supported fields for a Yarn project manifest (package.json files)`}
      keywords={defaultKeywords}
    />
    {configuration}
  </ConfigurationLayout>
</>;

// eslint-disable-next-line arca/no-default-export
export default PackageJsonDoc;
