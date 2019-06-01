import { useLayoutEffect, useRef } from "react";

const useScroll = id => {
  const ref = useRef();

  const handleScroll = () => {
    setBrowserStorage(id ,ref.current.scrollTop);
  };

  const readBrowserStorage = id => {
    return sessionStorage.getItem(`gatsby:navigation:${id}`);
  }

  const setBrowserStorage = (id, pos) => {
    sessionStorage.setItem(`gatsby:navigation:${id}`, pos.toString());
  }

  useLayoutEffect(() => {
    const initPos = readBrowserStorage(id);
    ref.current.scrollTop = initPos == null ? 0 : parseInt(initPos, 10);
    return () => handleScroll();
  }, []);

  return ref;
};

export default useScroll;
