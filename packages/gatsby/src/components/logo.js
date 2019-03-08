import Img                    from 'gatsby-image';
import PropTypes              from 'prop-types';
import React                  from 'react';

import yarnKittenFull         from '../images/yarn-kitten-full.svg';

/*
 * This component is built using `gatsby-image` to automatically serve optimized
 * images with lazy loading and reduced file sizes. The image is loaded using a
 * `StaticQuery`, which allows us to load the image from directly within this
 * component, rather than having to pass the image data down from pages.
 *
 * For more information, see the docs:
 * - `gatsby-image`: https://gatsby.dev/gatsby-image
 * - `StaticQuery`: https://gatsby.dev/staticquery
 */

const Logo = ({align, height}) => (
  <img src={yarnKittenFull} style={{height, verticalAlign: align}} />
);

Logo.propTypes = {
  align: PropTypes.string,
  height: PropTypes.number,
};

Logo.defaultProps = {
  height: 100,
};

export default Logo;
