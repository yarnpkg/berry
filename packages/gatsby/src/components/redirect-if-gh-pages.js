/**
 * Redirect component that queries for data with
 *  Gatsby's useStaticQuery React hook
 *
 * See: https://www.gatsbyjs.org/docs/use-static-query/
 */

import { useStaticQuery, graphql } from "gatsby";
import React, {useEffect} from "react"


function RedirectIfGHPages() {
  const { site } = useStaticQuery(
    graphql`
      query {
        site {
          siteMetadata {
            shouldRedirectToNext
            nextHostname
          }
        }
      }
    `
  );
  useEffect(() => {
    if (site.siteMetadata.shouldRedirectToNext) {
      const { pathname, search, hash } = window.location;
      window.location = `https://${site.siteMetadata.nextHostname}${pathname}${search}${hash}`;
    }
  }, [])
  return null;
}

export default RedirectIfGHPages;
