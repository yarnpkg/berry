import React, {useEffect}     from 'react';

import {Layout}               from '../../components/layout';
import Playground             from '../../components/playground/Playground';
import {SANDBOX_URL}          from '../../components/playground/constants';
import {SEO, defaultKeywords} from '../../components/seo';


const PlaygroundFrame = () => {
  useEffect(() => {
    if (window.location !== window.parent.location)
      return;

    if (process.env.NODE_ENV === `development`)
      return;

    window.location.replace(SANDBOX_URL);
  });

  return (<>
    <Layout>
      <SEO title={`Playground`} keywords={defaultKeywords} />
      <Playground />
    </Layout>
  </>);
};

// eslint-disable-next-line arca/no-default-export
export default PlaygroundFrame;
