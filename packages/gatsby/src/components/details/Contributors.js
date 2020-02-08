import styled  from '@emotion/styled';
import React   from 'react';

import {Owner} from '../hit';

const List = styled.ul`
  list-style-type: none;
  padding-inline-start: 0;
  padding-left: 0;
`;

export const Contributors = ({contributors}) => (
  <article>
    <h1>Contributors</h1>
    <List>
      {contributors.map(contributor => (
        <li key={contributor.name}>
          <Owner {...contributor} />
        </li>
      ))}
    </List>
  </article>
);
