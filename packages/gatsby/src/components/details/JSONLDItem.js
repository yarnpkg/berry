import React from 'react';
import { packageLink } from '../util';

/**
 * JSON-ld is a technology that allows crawlers to get info about
 * documents on the web, in a more structured way that microdata.
 *
 * Here we use schema.org's documents that describe a SoftwareApplication
 * of the type DeveloperApplication. It takes the description, name
 * url etc from this package data.
 *
 * Crawlers like Google can take this data and then display the Yarn
 * detail page however they want Software to look.
 *
 * At this point Google etc. doesn't display it separately yet, but since
 * both Yarn, npm and other sites include this information, they might
 * very well in the future.
 *
 * read more about it on: http://json-ld.org
 */

const JSONLDItem = ({ name, description, keywords }) => (
  <script type="application/ld+json">
    {JSON.stringify({
      '@context': 'http://schema.org',
      '@type': 'SoftwareApplication',
      name: name,
      description: description,
      url: packageLink(name),
      keywords: keywords.join(','),
      applicationCategory: 'DeveloperApplication',
      offers: {
        '@type': 'Offer',
        price: '0.00',
      },
    })}
  </script>
);

export default JSONLDItem;
