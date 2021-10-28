import React, {useState}              from 'react';

import IcoReadMore                    from '../../images/detail/ico-readmore.svg';

import {ReadMoreButton, ReadMoreIcon} from './ReadMore';
import {Di}                           from './';

const _localeVersion = pubDate =>
  new Date(pubDate).toLocaleDateString(`en`, {
    year: `numeric`,
    month: `long`,
    day: `numeric`,
  });

export const Versions = ({versions}) => {
  const [showMore, setShowMore] = useState(false);
  const toggleShowMore = () => setShowMore(!showMore);

  const versionKeys = Object.keys(versions);
  const buttonText = showMore
    ? `Hide`
    : `Display all`;
  const versionsToShow = showMore
    ? versionKeys.reverse()
    : versionKeys.reverse().slice(0, 3);

  return (
    <article>
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
        <ReadMoreButton onClick={toggleShowMore}>
          {buttonText}
          <ReadMoreIcon
            src={IcoReadMore}
            alt={``}
            style={{transform: showMore ? `rotate(180deg) translateY(3px)` : `translateY(-1px)`}}
          />
        </ReadMoreButton>
      )}
    </article>
  );
};
