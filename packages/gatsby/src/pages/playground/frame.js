import React                  from 'react';

import {Layout}               from '../../components/layout';
import Playground             from '../../components/playground/Playground';
import {SEO, defaultKeywords} from '../../components/seo';


const PlaygroundFrame = () => <>
  <Layout>
    <SEO title="Playground" keywords={defaultKeywords} />
    <Playground />
  </Layout>
</>;

// eslint-disable-next-line arca/no-default-export
export default PlaygroundFrame;
