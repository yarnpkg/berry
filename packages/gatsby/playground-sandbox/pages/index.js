import Head                from 'next/head';
import {useRef, useEffect} from 'react';

const WEBSITE_URL = `https://yarnpkg.com`;

const Home = () => {
  const iframeEl = useRef(null);

  useEffect(() => {
    iframeEl.current.src += window.location.search;
  }, []);

  return (
    <div className={`container`}>
      <Head>
        <title>Sherlock Playground</title>
      </Head>

      <main>
        <iframe
          ref={iframeEl}
          title={`playground`}
          src={`${WEBSITE_URL}/playground/frame`}
          allow={`fullscreen`}
          width={`100%`}
          height={`100%`}
          frameBorder={`0`}
        />
      </main>
    </div>
  );
};

// eslint-disable-next-line arca/no-default-export
export default Home;
