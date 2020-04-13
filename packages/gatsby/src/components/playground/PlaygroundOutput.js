import 'xterm/css/xterm.css';
import styled   from '@emotion/styled';
import Loadable from "@loadable/component";
import React    from 'react';

const XTerm = Loadable(() => import(`react-xterm`));

const OutputContainer = styled.div`
  grid-area: output;

  height: 60vh;

  .xterm {
    padding: 10px;
  }
`;

const PlaygroundOutput = ({outputState: [output]}) => (
  <OutputContainer>
    <XTerm
      value={output}
      options={{
        // Disable cursor
        cursorStyle: `bar`,
        cursorWidth: 0,

        disableStdin: true,

        rows: 16,

        cols: 45,
      }}
    />
  </OutputContainer>
);

// eslint-disable-next-line arca/no-default-export
export default PlaygroundOutput;
