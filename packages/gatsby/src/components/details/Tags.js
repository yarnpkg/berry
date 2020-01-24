import React from 'react';

import {Di}  from './';

export const Tags = ({tags}) => {
  const tagNames = Object.keys(tags);
  if (tagNames.length === 0)
    return null;


  return (
    <article>
      <h1>Tags</h1>
      <dl>
        {tagNames.map(tag => (
          <Di key={tag} title={<code>{tag}</code>} description={tags[tag]} />
        ))}
      </dl>
    </article>
  );
};
