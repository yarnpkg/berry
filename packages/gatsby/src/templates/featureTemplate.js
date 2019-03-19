import styled                from '@emotion/styled';
import {graphql}             from 'gatsby';
import React                 from 'react';

import Layout                from '../components/layout';
import {PrerenderedMarkdown} from '../components/markdown';
import Navigation            from '../components/navigation';
import {ifDesktop}           from '../components/responsive';

const Container = styled.div`
  padding: 2em;

  ${ifDesktop} {
    border-top: 1px solid #cfdee9;

    text-align: justify;
  }
`;

export default function Template({data}) {
  const {allMarkdownRemark, markdownRemark} = data;
  const {frontmatter, html} = markdownRemark;

  return <>
    <Layout>
      <Navigation items={allMarkdownRemark.edges.map(({node}) => ({
        to: node.frontmatter.path,
        name: node.frontmatter.title,
      }))}>
        <Container>
          <div style={{maxWidth: 900}}>
            <PrerenderedMarkdown title={frontmatter.title}>
              {html}
            </PrerenderedMarkdown>
          </div>
        </Container>
      </Navigation>
    </Layout>
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
