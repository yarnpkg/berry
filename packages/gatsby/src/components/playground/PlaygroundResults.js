import styled          from '@emotion/styled';
import Icon            from '@mdi/react';
import ReactTooltip    from 'react-tooltip';
import React           from 'react';

import PlaygroundLabel from './PlaygroundLabel';

const Results = styled.div`
  grid-area: label;

  text-align: center;

  line-height: 1;

  margin-top: 0.6rem;
`;

const PlaygroundResults = ({labelState: [label]}) => (
  <>
    {label &&
      <Results>
        <PlaygroundLabel {...label} />
        <br />
        <ReactTooltip
          type={label.type}
          place={`top`}
        />
        <Icon
          path={label.icon}
          size={1.5}
          data-tip={label.help}
        />
      </Results>
    }
  </>
);

// eslint-disable-next-line arca/no-default-export
export default PlaygroundResults;
