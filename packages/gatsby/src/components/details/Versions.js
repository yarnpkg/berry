import React, { Component } from 'react';
import { Di } from './';

const _localeVersion = pubDate =>
  new Date(pubDate).toLocaleDateString('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

export default class Versions extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isShowingMore: false,
    };
  }

  _toggleShowMore() {
    this.setState(({ isShowingMore }) => ({
      isShowingMore: !isShowingMore,
    }));
  }

  render() {
    const { versions } = this.props;
    const { isShowingMore } = this.state;
    const versionKeys = Object.keys(versions);
    const buttonText = isShowingMore
      ? 'Hide'
      : 'Display all';
    const versionsToShow = isShowingMore
      ? versionKeys.reverse()
      : versionKeys.reverse().slice(0, 3);

    return (
      <article className="details-side--versions">
        <h1>Versions</h1>
        <dl>
          {versionsToShow.map(version => (
            <Di
              key={version}
              title={_localeVersion(versions[version])}
              description={version}
            />
          ))}
        </dl>
        {versionKeys.length > 3 && (
          <button
            onClick={() => this._toggleShowMore()}
            className="readMore--button"
          >
            {buttonText}
            <img
              src="/assets/detail/ico-readmore.svg"
              alt=""
              className="readMore--icon"
              style={{ transform: isShowingMore ? 'rotate(180deg)' : '' }}
            />
          </button>
        )}
      </article>
    );
  }
}
