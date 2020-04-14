import Head from 'next/head';

// TODO: replace with `https://yarnpkg.com`
const WEBSITE_URL = `https://deploy-preview-1193--yarn2.netlify.com`;

const Home = () => (
  <div className="container">
    <Head>
      <title>Sherlock Playground</title>
    </Head>

    <main>
      <iframe
        title="playground"
        src={`${WEBSITE_URL}/playground/frame`}
        allow="fullscreen"
        width="100%"
        height="100%"
        frameBorder="0"
      />
    </main>
  </div>
);

// eslint-disable-next-line arca/no-default-export
export default Home;
