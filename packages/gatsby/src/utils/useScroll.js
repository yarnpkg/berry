import { useLayoutEffect, useRef } from "react";

const useScroll = id => {
  const ref = useRef();

  const handleScroll = () => {
    setBrowserStorage(id ,ref.current.scrollTop);
  };

  const readBrowserStorage = id => {
    return sessionStorage.getItem(`gatsby:navigation:${id}`);
  }

  const setBrowserStorage = (id ,pos) => {
    sessionStorage.setItem(`gatsby:navigation:${id}`, pos.toString());
  }

  // initial render
  useLayoutEffect(() => {
    const initPos = readBrowserStorage(id);
    ref.current.scrollTop = initPos == null ? 0 : parseInt(initPos, 10);
  }, []);

  useLayoutEffect(() => {
    ref.current.addEventListener("scroll", handleScroll);
    return () => ref.current.removeEventListener("scroll", handleScroll);
  }, []);

  return ref;
};

export default useScroll;
