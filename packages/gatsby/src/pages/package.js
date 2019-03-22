import React, {useEffect, useState} from 'react';

import {LayoutContentNav}           from '../components/layout-content-nav';
import {Markdown}                   from '../components/markdown';
import useAlgolia                   from '../utils/useAlgolia';
import useLocation                  from '../utils/useLocation';

export const PackagePage = () => {
  const [data, setData] = useState(null);

  const location = useLocation();
  const {index} = useAlgolia();

  const packageName = location.search.slice(1);

  useEffect(() => {
    let cancelled = false;

    if (index !== null) {
      index.getObject(packageName).then(data => {
        if (!cancelled) {
          setData(data);
        }
      });
    } else {
      setData(null);
    }

    return () => {
      cancelled = true;
    };
  }, [
    index,
    packageName,
  ]);

  return <>
    <LayoutContentNav items={[{
      to: `/package?${packageName}`,
      name: `Information`,
    }, {
      to: `/package?${packageName}`,
      name: `Manifest File`,
    }, {
      to: `/package?${packageName}`,
      name: `File List`,
    }, {
      to: `/package?${packageName}`,
      name: `Dependency Tree`,
    }]}>
      {data && <Markdown>{data.readme}</Markdown>}
    </LayoutContentNav>
  </>;
}

export default PackagePage;
