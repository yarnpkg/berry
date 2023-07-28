import '@fontsource/pt-sans';
import 'github-markdown-css';
import 'react-loading-skeleton/dist/skeleton.css';
import {useLocation}                      from '@docusaurus/router';
import {QueryClient, QueryClientProvider} from 'react-query';
import {Tooltip as ReactTooltip}          from 'react-tooltip';
import React, {useLayoutEffect}           from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      suspense: true,
    },
  },
});

// eslint-disable-next-line arca/no-default-export
export default function Root({children}: {children: React.ReactNode}) {
  const route = useLocation();

  useLayoutEffect(() => {
    document.body.setAttribute(`x-doc-route`, route.pathname);
  });

  return <>
    <ReactTooltip id={`tooltip`}/>
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  </>;
}
