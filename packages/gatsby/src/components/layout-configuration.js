import PropTypes    from 'prop-types';
import React        from 'react';

import {Layout}     from './layout';
import {Navigation} from './navigation';

export const ConfigurationLayout = ({children}) => <>
  <Layout>
    <Navigation
      items={[
        {to: `/configuration/manifest`, name: `Manifests`, tag: `package.json`},
        {to: `/configuration/yarnrc`, name: `Yarnrc files`, tag: `.yarnrc.yml`},
      ]}
    >
      {children}
    </Navigation>
  </Layout>
</>;

ConfigurationLayout.propTypes = {
  children: PropTypes.node.isRequired,
};
