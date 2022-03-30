import {StaticQuery, graphql} from 'gatsby';
import marked                 from 'marked';
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
            <h3 id={`hook-${name}`} style={{position: `relative`}}>
              <a href={`#hook-${name}`} className={`anchor before`}>
                <svg aria-hidden={`true`} focusable={`false`} height={`16`} version={`1.1`} viewBox={`0 0 16 16`} width={`16`}><path fill-rule={`evenodd`} d={`M4 9h1v1H4c-1.5 0-3-1.69-3-3.5S2.55 3 4 3h4c1.45 0 3 1.69 3 3.5 0 1.41-.91 2.72-2 3.25V8.59c.58-.45 1-1.27 1-2.09C10 5.22 8.98 4 8 4H4c-.98 0-2 1.22-2 2.5S3 9 4 9zm9-3h-1v1h1c1 0 2 1.22 2 2.5S13.98 12 13 12H9c-.98 0-2-1.22-2-2.5 0-.83.42-1.64 1-2.09V6.25c-1.09.53-2 1.84-2 3.25C6 11.31 7.55 13 9 13h4c1.45 0 3-1.69 3-3.5S14.5 6 13 6z`}></path></svg>
              </a>
              <code>{name}</code>
            </h3>
            {comment.split(/\n\n/).map((text, index) => (
              <div key={index} dangerouslySetInnerHTML={{__html: marked(text)}} />
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
