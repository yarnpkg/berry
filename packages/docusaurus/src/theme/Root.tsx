import '@fontsource/pt-sans';
import 'github-markdown-css';
import 'react-loading-skeleton/dist/skeleton.css';
import Head                               from '@docusaurus/Head';
import {useLocation}                      from '@docusaurus/router';
import {QueryClient, QueryClientProvider} from 'react-query';
import {Tooltip as ReactTooltip}          from 'react-tooltip';
import React                              from 'react';

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

  return <>
    <Head>
      <html x-doc-route={route.pathname}/>
    </Head>
    <ReactTooltip id={`tooltip`}/>
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  </>;
}
