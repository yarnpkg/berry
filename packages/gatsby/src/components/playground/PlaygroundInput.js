import styled   from '@emotion/styled';
import Loadable from "@loadable/component";
import React    from 'react';

const MonacoEditor = Loadable(() => import(`react-monaco-editor`));

const InputContainer = styled.div`
  grid-area: input;

  height: 60vh;
`;

const PlaygroundInput = ({inputState: [input, setInput]}) => (
  <InputContainer>
    <MonacoEditor
      value={input}
      onChange={(newValue) => setInput(newValue)}
      language={`javascript`}
      theme={`vs-dark`}
      options={{
        scrollBeyondLastLine: false,
      }}
    />
  </InputContainer>
);

// eslint-disable-next-line arca/no-default-export
export default PlaygroundInput;
