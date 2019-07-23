import React   from 'react';

import {Owner} from '../hit';

const Contributors = ({ contributors }) => (
  <article>
    <h1>Contributors</h1>
    <ul>
      {contributors.map(contributor => (
        <li key={contributor.name}>
          <Owner {...contributor} />
        </li>
      ))}
    </ul>
  </article>
);

export default Contributors;
