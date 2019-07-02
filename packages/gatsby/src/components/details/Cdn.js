import React, { Component } from 'react';
import { Di } from './';

const JsDelivr = ({ name, version }) => (
  <Di
    title="jsDelivr"
    description={
      <a
        href={`https://cdn.jsdelivr.net/npm/${name}@${version}/`}
        target="_blank"
        rel="noopener noreferrer"
      >
        cdn.jsdelivr.net/npm/{name}/
      </a>
    }
  />
);

const Unpkg = ({ name, version }) => (
  <Di
    title="unpkg"
    description={
      <a
        href={`https://unpkg.com/${name}@${version}/`}
        target="_blank"
        rel="noopener noreferrer"
      >
        unpkg.com/{name}/
      </a>
    }
  />
);

const BundleRun = ({ name, version }) => (
  <Di
    title="bundle.run"
    description={
      <a
        href={`https://bundle.run/${name}@${version}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        bundle.run/{name}
      </a>
    }
  />
);

class Cdn extends Component {
  constructor(props) {
    super(props);

    this.cdns = {
      jsdelivr: JsDelivr,
      unpkg: Unpkg,
      bundlerun: BundleRun,
    };

    this.order = Object.keys(this.cdns).sort(() => {
      return Math.random() - 0.5;
    });
  }

  render() {
    const items = this.order.map(key => {
      const Component = this.cdns[key];
      return (
        <Component
          key={key}
          name={this.props.name}
          version={this.props.version}
        />
      );
    });

    return (
      <article className="details-side--cdns">
        <h1>CDNs</h1>
        <dl>{items}</dl>
      </article>
    );
  }
}

export default Cdn;
