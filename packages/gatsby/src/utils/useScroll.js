import {useLayoutEffect, useRef} from 'react';

const useScroll = () => {
  const ref = useRef();

  const readBrowserStorage = id => {
    try {
      return sessionStorage.getItem(`berry:navigation:${id}`);
    } catch {
      return undefined;
    }
  };

  const setBrowserStorage = (id, pos) => {
    try {
      sessionStorage.setItem(`berry:navigation:${id}`, pos.toString());
    } catch {}
  };

  useLayoutEffect(() => {
    const id = window.location.pathname.split(`/`)[1];
    const initPos = readBrowserStorage(id);
    ref.current.scrollTop = initPos == null ? 0 : parseInt(initPos, 10);
    return () => setBrowserStorage(id, ref.current.scrollTop);
  }, []);

  return ref;
};

// eslint-disable-next-line arca/no-default-export
export default useScroll;
