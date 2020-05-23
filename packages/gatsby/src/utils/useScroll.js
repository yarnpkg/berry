import { useLayoutEffect, useRef } from "react";

const useScroll = () => {
  const ref = useRef();

  const readBrowserStorage = id => {
    return sessionStorage.getItem(`berry:navigation:${id}`);
  }

  const setBrowserStorage = (id, pos) => {
    sessionStorage.setItem(`berry:navigation:${id}`, pos.toString());
  }

  useLayoutEffect(() => {
    const id = window.location.pathname.split(`/`)[1];
    const initPos = readBrowserStorage(id);
    ref.current.scrollTop = initPos == null ? 0 : parseInt(initPos, 10);
    return () => setBrowserStorage(id, ref.current.scrollTop);
  }, []);

  return ref;
};

export default useScroll;
