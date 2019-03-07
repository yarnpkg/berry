import {Link} from 'gatsby';
import React  from 'react';

import SEO    from '../components/seo';
import Layout from '../components/layout';

const SecondPage = () => (
  <Layout>
    <SEO title="Page two" />
    <h1>Hi from the second page</h1>
    <p>Welcome to page 2</p>
    <Link to="/">Go back to the homepage</Link>
  </Layout>
);

export default SecondPage;
