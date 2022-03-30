import styled        from '@emotion/styled';
import {MDXRenderer} from 'gatsby-plugin-mdx';
import React         from 'react';

const Container = styled.article`
  line-height: 1.7;
`;

const TitleContainer = styled.div`
  border-bottom: 1px solid;
  display: flex;
  align-items: baseline;
  justify-content: space-between;

  flex-wrap: wrap-reverse;
`;
const Title = styled.h1`
  box-sizing: border-box;

  margin: 0;

  font-weight: 600;
  font-size: 2rem;
  line-height: 4rem;

  + div > blockquote {
    font-style: normal;
  }
`;

const EditLink = styled.a`
  font-size: initial;
  font-weight: initial;
  line-height: initial;
`;

const Content = styled.div`
  blockquote {
    margin-left: 0;
    margin-right: 0;

    border-left: 5px solid #859daf;

    padding: 1em;

    font-style: italic;

    background-color: #fff3e2;
  }

  blockquote > ul {
    margin: 0;
    padding: 0.5em 2em;
  }

  blockquote > p {
    margin: 0;
  }

  a:not(.anchor) {
    border-bottom: 1px solid;

    text-decoration: none;

    color: #007aa2;

    &:hover {
      color: #62b0ca;
    }
  }

  .toc, p, ul, table {
    margin: 1.5em 0;
  }

  .toc {
    padding: 2em 3em;

    color: #007aa2;
    background-color: #e4e9f7;
  }

  .toc ul {
    margin: 1em 0;

    padding-left: 2em;

    list-style-type: upper-latin;
    list-style-position: inside;
  }

  .toc-no-item ul {
    list-style-type: none;
  }

  .toc ul ul {
    list-style-type: none;
  }

  .toc > ul {
    padding-left: 0;
  }

  .toc li {
    margin: 0.5em 0;
  }

  .toc p {
    display: inline;

    margin: 0;
  }

  .toc a {
    border-bottom: 0;
  }

  table {
    width: 100%;

    border-collapse: collapse;
  }

  th {
    color: #007aa2;
  }

  th, td {
    border: 1px solid #007aa2;

    padding: .5em 1em;
  }

  h1 {
    margin-top: 0;
  }

  h2, h3, h4 {
    padding-bottom: 0.2em;

    font-weight: 600;
  }

  pre {
    padding: 1em;

    overflow-x: auto;

    background: #242424;
  }

  summary p {
    display: inline;

    margin: 0;
  }

  code {
    display: inline-block;

    text-align: left;

    color: #007aa2;

    font-family: "PT Mono";
  }

  pre code {
    color: #ddddcc;
  }

  img {
    max-width: 100%;
  }
`;

export const PrerenderedMarkdown = ({title, children, editUrl}) => <>
  <Container>
    <TitleContainer>
      <Title>
        {title.match(/^`.*`$/) ? <code>{title.slice(1, -1)}</code> : title}
      </Title>
      {editUrl && <EditLink target={`_blank`} href={editUrl}>Edit this page on GitHub</EditLink>}
    </TitleContainer>
    <Content>
      <MDXRenderer>
        {children}
      </MDXRenderer>
    </Content>
  </Container>
</>;
