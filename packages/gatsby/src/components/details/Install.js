import React, { Component } from 'react';
import Copyable from './Copyable';

export default class Install extends Component {
  render() {
    const { name, onOpenFileBrowser } = this.props;
    return (
      <article className="details-side--copy">
        <h1>Use it</h1>
        <Copyable pre="$ " tag="code">
          yarn add {name}
        </Copyable>
        <div>
          <a
            className="details-side--runkit"
            href={`https://runkit.com/npm/${name}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Try in RunKit
          </a>
          {' · '}
          <button onClick={onOpenFileBrowser}>
            Browse Files
          </button>
        </div>
      </article>
    );
  }
}
