import styled from '@emotion/styled';
import React  from 'react';

const Container = styled.article`
  padding: 1em;
`;

const Title = styled.h1`
  font-size: 2em;

  margin: 0;
`;

const Content = styled.div`
`;

export const PrerenderedMarkdown = ({title, children}) => <>
  <Container>
    <Title>
      {title}
    </Title>
    <Content dangerouslySetInnerHTML={{__html: children}} />
  </Container>
</>;
