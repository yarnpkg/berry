/**
 * Layout component that queries for data
 * with Gatsby's StaticQuery component
 *
 * See: https://www.gatsbyjs.org/docs/static-query/
 */

import './layout.css';

import PropTypes from 'prop-types';
import {Helmet}  from 'react-helmet';
import React     from 'react';

import Header    from './header';

const Layout = ({ children }) => <>
  <Helmet>
    <meta name={`viewport`} content={`width=device-width, initial-scale=1`} />
  </Helmet>
  <Header/>
  <main>
    {children}
  </main>
</>;

Layout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default Layout;
