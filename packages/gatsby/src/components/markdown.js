import styled from '@emotion/styled';
import React  from 'react';

const Container = styled.article`
`;

const Title = styled.h1`
  font-family: "Baumans";
  font-size: 2em;

  margin: 0;
`;

const Content = styled.div`
  a {
    border-bottom: 1px solid;

    text-decoration: none;

    color: #007aa2;

    &:hover {
      color: #62b0ca;
    }
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
