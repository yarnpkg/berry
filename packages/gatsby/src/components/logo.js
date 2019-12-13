import PropTypes      from 'prop-types';
import React          from 'react';

import yarnKittenFull from '../images/yarn-kitten-full.svg';

const Logo = ({align, height}) => (
  <img alt={`Yarn`} src={yarnKittenFull} style={{height, verticalAlign: align}} />
);

Logo.propTypes = {
  align: PropTypes.string,
  height: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
  ]),
};

Logo.defaultProps = {
  height: 100,
};

export default Logo;
