import {globalHistory}       from '@reach/router';
import {useEffect, useState} from 'react';

const useLocation = () => {
  const [location, setLocation] = useState(globalHistory.location);

  useEffect(() => {
    const removeListener = globalHistory.listen(({location}) => {
      setLocation(location);
    });

    return () => {
      removeListener();
    };
  }, []);

  return location;
};

export default useLocation;
