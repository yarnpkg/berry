import styled   from '@emotion/styled';
import React    from 'react';
import markdown from 'remark-parse';
import html     from 'remark-html';
import unified  from 'unified';

import useCache from '../utils/useCache';

const Container = styled.article`
`;

const Title = styled.h1`
  font-family: "Baumans";
  font-size: 2em;

  margin: 0;

  + div > blockquote {
    font-style: normal;
  }
`;

const Content = styled.div`
  blockquote {
    margin-left: 0;

    border-left: 3px solid #859daf;

    padding-left: .5em;

    font-style: italic;

    color: #859daf;
  }

  a {
    border-bottom: 1px solid;

    text-decoration: none;

    color: #007aa2;

    &:hover {
      color: #62b0ca;
    }
  }

  p, table {
    margin-bottom: 1em;
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

  h2 {
    border: 1px solid #d1dee8;

    padding-bottom: 0.2em;
  }

  pre {
    padding: 1em;

    overflow-x: auto;

    background: #242424;
  }

  code {
    font-family: "PT Mono";

    color: #007aa2;
  }

  pre code {
    color: #ddddcc;
  }
`;

export const PrerenderedMarkdown = ({title, children}) => <>
  <Container>
    <Title>
      {title}
    </Title>
    <Content dangerouslySetInnerHTML={{__html: children}} />
  </Container>
</>;

export const Markdown = ({title, children}) => {
  const document = useCache(() => {
    return unified().use(markdown).use(html, {
      sanitize: true,
    }).process(children);
  }, [
    children,
  ]);

  return document ? <>
    <PrerenderedMarkdown title={title}>
      {String(document)}
    </PrerenderedMarkdown>
  </> : null;
}
