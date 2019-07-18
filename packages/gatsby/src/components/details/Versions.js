import React, { Component } from 'react';
import { Di }               from './';

import { ReadMoreButton, ReadMoreIcon } from './ReadMore';
import IcoReadMore                      from '../../images/detail/ico-readmore.svg';

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
          <ReadMoreButton
            onClick={() => this._toggleShowMore()}
          >
            {buttonText}
            <ReadMoreIcon
              src={IcoReadMore}
              alt=""
              style={{ transform: isShowingMore ? 'rotate(180deg)' : '' }}
            />
          </ReadMoreButton>
        )}
      </article>
    );
  }
}
