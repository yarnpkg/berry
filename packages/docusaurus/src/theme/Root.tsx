import {useLocation}            from '@docusaurus/router';
import React, {useLayoutEffect} from 'react';

// eslint-disable-next-line arca/no-default-export
export default function Root({children}: {children: React.ReactNode}) {
  const route = useLocation();

  useLayoutEffect(() => {
    document.body.setAttribute(`x-doc-route`, route.pathname);
  });

  return <>{children}</>;
}
