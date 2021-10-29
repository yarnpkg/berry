import {Sparklines, SparklinesLine} from '@haroenv/react-sparklines';
import React                        from 'react';

import {Di}                         from './';

export const Activity = ({
  graphData,
  graphLink,
  lastCommit,
  commitsLastThreeMonths,
}) => {
  if (!graphData && !graphLink && !lastCommit && !commitsLastThreeMonths)
    return null;


  return (
    <article>
      <h1>Activity</h1>

      {graphData && (
        <a href={graphLink} target={`_blank`} rel={`noopener noreferrer`}>
          <Sparklines data={graphData} width={100} height={15}>
            <SparklinesLine color={`#2C8EBB`} />
          </Sparklines>
        </a>
      )}
      <dl>
        {commitsLastThreeMonths >= 0 && (
          <Di
            icon={`commits`}
            title={`Commits last 3 months`}
            description={commitsLastThreeMonths}
          />
        )}
        {lastCommit && (
          <Di
            icon={`commits-last`}
            title={`Last commit`}
            description={lastCommit}
          />
        )}
      </dl>
    </article>
  );
};
