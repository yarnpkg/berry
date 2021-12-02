import {Global, css}         from '@emotion/react';
import {graphql}             from 'gatsby';
import React                 from 'react';

import {LayoutContentNav}    from '../components/layout-content-nav';
import {PrerenderedMarkdown} from '../components/markdown';
import {SEO}                 from '../components/seo';

const GlobalStyleOverrides = css`
:root {
  --header-border-bottom: 1px solid #cfdee9;
}
`;
const GIT_URL_EDIT_PREFIX = `https://github.com/yarnpkg/berry/tree/master/packages/gatsby/content`;
const CONTENT_DIR = `/content/`;

function getGitPageUrl(postAbsolutePath) {
  if (!postAbsolutePath) return undefined;
  const pathIndex =
    postAbsolutePath.indexOf(CONTENT_DIR) + CONTENT_DIR.length;
  const relativePath = postAbsolutePath.slice(pathIndex);
  return `${GIT_URL_EDIT_PREFIX}/${relativePath}`;
}

// eslint-disable-next-line arca/no-default-export
export default function Template({data}) {
  const {allMdx, mdx} = data;
  const {frontmatter, body, fileAbsolutePath} = mdx;

  const orderedItems = [];
  const items = [];

  for (const {node} of allMdx.edges) {
    const {path, title, order} = node.frontmatter;
    const item = {
      to: path,
      name: title,
    };

    if (typeof order === `number`) {
      orderedItems[order - 1] = item;
    } else {
      items.push(item);
    }
  }

  return <>
    <Global styles={GlobalStyleOverrides} />
    <LayoutContentNav items={orderedItems.concat(items)}>
      <SEO
        title={frontmatter.title}
        description={frontmatter.description}
        keywords={[`package manager`, `yarn`, `yarnpkg`, frontmatter.path.split(`/`).reverse()[0]]}
      />
      <PrerenderedMarkdown title={frontmatter.title} editUrl={getGitPageUrl(fileAbsolutePath)}>
        {body}
      </PrerenderedMarkdown>
    </LayoutContentNav>
  </>;
}

export const pageQuery = graphql`
  query($path: String!, $category: String) {
    allMdx(
      filter: {frontmatter: {category: {eq: $category}, hidden: {ne: true}}}
      sort: {order: ASC, fields: [frontmatter___title]}
    ) {
      edges {
        node {
          frontmatter {
            path
            title
            order
          }
        }
      }
    }

    mdx(frontmatter: {category: {eq: $category}, path: {eq: $path}}) {
      body
      fileAbsolutePath
      frontmatter {
        path
        title
        description
      }
    }
  }
`;
