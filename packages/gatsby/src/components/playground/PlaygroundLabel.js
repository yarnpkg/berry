import styled    from '@emotion/styled';
import React     from 'react';
import tinycolor from 'tinycolor2';

const Label = styled.div`
  text-align: center;

  line-height: 1.25;
  font-size: 14px;
  font-weight: 600;

  padding: 4px 8px;
  border-radius: 3px;
`;

/**
 * A Label component meant to mimic the GitHub labels as much as possible.
 */
const PlaygroundLabel = ({text, color}) => (
  <Label style={{
    background: color,
    color: tinycolor(color).isDark() ? `#fff` : `#000`,
  }}>
    {text}
  </Label>
);

// eslint-disable-next-line arca/no-default-export
export default PlaygroundLabel;
