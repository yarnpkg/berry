import PropTypes    from 'prop-types';
import React        from 'react';

import {Layout}     from './layout';
import {Navigation} from './navigation';

export const ConfigurationLayout = ({children}) => <>
  <Layout>
    <Navigation
      items={[
        {to: `/configuration/manifest`, name: `Manifests`},
        {to: `/configuration/yarnrc`, name: `Yarnrc files`},
      ]}
    >
      {children}
    </Navigation>
  </Layout>
</>;

ConfigurationLayout.propTypes = {
  children: PropTypes.node.isRequired,
};
