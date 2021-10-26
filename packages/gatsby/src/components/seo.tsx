/**
 * SEO component that queries for data with
 *  Gatsby's useStaticQuery React hook
 *
 * See: https://www.gatsbyjs.org/docs/use-static-query/
 */

import {useStaticQuery, graphql} from 'gatsby';
import Helmet                    from 'react-helmet';
import React                     from 'react';

import yarnKittenFull            from '../images/yarn-kitten-full.svg';
import {Query}                   from '../types/queries';

export const defaultKeywords = [`package manager`, `yarn`, `yarnpkg`, `configuration`, `yarnrc`];

export type SEOProps = {
  description?: string;
  lang?: string;
  meta?: Array<{name: string, content: string}>;
  keywords?: Array<string>;
  title: string;
};

export function SEO({description, lang = `en`, meta = [], keywords = [], title}: SEOProps) {
  const {site} = useStaticQuery<Query>(
    graphql`
      query {
        site {
          siteMetadata {
            title
            description
            author
          }
        }
      }
    `,
  );

  const metaDescription = description ?? site.siteMetadata.description;

  return (
    <Helmet
      htmlAttributes={{
        lang,
      }}
      title={title}
      titleTemplate={`%s | ${site.siteMetadata.title}`}
      meta={[
        {
          name: `description`,
          content: metaDescription,
        },
        {
          property: `og:title`,
          content: title,
        },
        {
          property: `og:description`,
          content: metaDescription,
        },
        {
          property: `og:image`,
          content: yarnKittenFull,
        },
        {
          property: `og:image:alt`,
          content: `Yarn Logo`,
        },
        {
          property: `og:type`,
          content: `website`,
        },
        {
          name: `twitter:card`,
          content: `summary`,
        },
        {
          name: `twitter:creator`,
          content: site.siteMetadata.author,
        },
        {
          name: `twitter:title`,
          content: title,
        },
        {
          name: `twitter:description`,
          content: metaDescription,
        },
        {
          property: `twitter:image`,
          content: yarnKittenFull,
        },
        {
          property: `twitter:image:alt`,
          content: `Yarn Logo`,
        },
      ]
        .concat(
          keywords.length > 0
            ? {
              name: `keywords`,
              content: keywords.join(`, `),
            }
            : [],
        )
        .concat(meta)}
    />
  );
}
