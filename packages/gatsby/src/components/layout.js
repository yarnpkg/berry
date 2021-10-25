/**
 * Layout component that queries for data
 * with Gatsby's StaticQuery component
 *
 * See: https://www.gatsbyjs.org/docs/static-query/
 */

import './layout.css';

// eslint-disable-next-line arca/import-ordering
import PropTypes from 'prop-types';
import {Helmet}  from 'react-helmet';
import React     from 'react';

import {Header}  from './header';

export const Layout = ({header, children}) => <>
  <Helmet>
    <meta name={`viewport`} content={`width=device-width, initial-scale=1`} />
    <link
      rel={`search`}
      href={`/opensearch.xml`}
      type={`application/opensearchdescription+xml`}
      title={`Yarn package search`}
    />
  </Helmet>
  {header ? header : <Header/>}
  <main>
    {children}
  </main>
</>;

Layout.propTypes = {
  children: PropTypes.node.isRequired,
};
