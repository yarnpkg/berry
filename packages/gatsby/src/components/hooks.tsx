import {StaticQuery, graphql} from 'gatsby';
import React                  from 'react';

export function Hooks() {
  return (
    <StaticQuery
      query={graphql`
        query MyQuery {
          yarnIntrospection(id: {eq: "0f47090c-afdf-5a02-98f8-047adfe6297f"}) {
            value {
              name
              definition
              comment
              file
            }
          }
        }
      `}
      render={data => <>
        {data.yarnIntrospection.value.map(({name, comment, definition}) => (
          <div key={name}>
            <h3><code>{name}</code></h3>
            {comment.split(/\n\n/).map((text, index) => (
              <p key={index}>{text}</p>
            ))}
            <pre><code>
              {definition}
            </code></pre>
          </div>
        ))}
      </>}
    />
  )
  ;
}
