import React          from 'react';

import yarnKittenFull from '../images/yarn-kitten-full.svg';

export type LogoProps = {
  align: string;
  height?: number | string;
};

export const Logo = ({align, height = 100}: LogoProps) => (
  <img alt={`Yarn`} src={yarnKittenFull} style={{height, verticalAlign: align}} />
);
