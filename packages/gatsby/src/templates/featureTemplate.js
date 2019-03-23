import {graphql}             from 'gatsby';
import React                 from 'react';

import {LayoutContentNav}    from '../components/layout-content-nav';
import {PrerenderedMarkdown} from '../components/markdown';

export default function Template({data}) {
  const {allMarkdownRemark, markdownRemark} = data;
  const {frontmatter, html} = markdownRemark;

  return <>
    <LayoutContentNav items={allMarkdownRemark.edges.map(({node}) => ({
      to: node.frontmatter.path,
      name: node.frontmatter.title,
    }))}>
      <PrerenderedMarkdown title={frontmatter.title}>
        {html}
      </PrerenderedMarkdown>
    </LayoutContentNav>
  </>;
}

export const pageQuery = graphql`
  query($path: String!) {
    allMarkdownRemark(
      filter: {frontmatter: {category: {eq: "features"}}}
      sort: {order: ASC, fields: [frontmatter___title]}
    ) {
      edges {
        node {
          frontmatter {
            path
            title
          }
        }
      }
    }
    markdownRemark(frontmatter: {category: {eq: "features"}, path: {eq: $path}}) {
      html
      frontmatter {
        path
        title
      }
    }
  }
`;
