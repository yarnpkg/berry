import {Redirect} from '@docusaurus/router';
import React      from 'react';

// eslint-disable-next-line arca/no-default-export
export default function Home() {
  return <Redirect to={`/configuration/manifest`} />;
}
