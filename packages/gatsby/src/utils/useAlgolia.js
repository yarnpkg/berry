import algoliasearch             from 'algoliasearch/lite';
import {graphql, useStaticQuery} from 'gatsby';
import {useEffect, useState}     from 'react';

// eslint-disable-next-line arca/no-default-export
export default function useAlgolia() {
  const [client, setClient] = useState(null);
  const [index, setIndex] = useState(null);

  const data = useStaticQuery(graphql`
    query HeaderQuery {
      site {
        siteMetadata {
          algolia {
            appId
            apiKey
            indexName
          }
        }
      }
    }
  `);

  const {
    appId,
    apiKey,
    indexName,
  } = data.site.siteMetadata.algolia;

  useEffect(() => {
    setClient(algoliasearch(appId, apiKey));
  }, [
    appId,
    apiKey,
  ]);

  useEffect(() => {
    if (client !== null) {
      setIndex(client.initIndex(indexName));
    } else {
      setIndex(null);
    }
  }, [
    client,
    indexName,
  ]);

  return {client, index};
}
