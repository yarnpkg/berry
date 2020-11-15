export const ifMobile = () => `@media (max-width: 760px)`;
export const ifDesktop = () => `@media (min-width: 761px)`;

// credits: https://github.com/janosh/blog/blob/master/src/utils/mediaQueries.js
const min = width => `only screen and (min-width: ${width}em)`
const max = width => `only screen and (max-width: ${width}em)`

// screen sizes in em units
export const screens = {
  phone: 30,
  phablet: 40,
  tablet: 50,
  netbook: 60,
  laptop: 70,
  desktop: 100,
}

export const mediaQueries = Object.entries(screens).reduce((acc, [key, val]) => {
  const Key = key[0].toUpperCase() + key.substr(1)
  // css query
  acc[`min` + Key] = `@media ` + min(val)
  acc[`max` + Key] = `@media ` + max(val)
  // js query (see window.matchMedia)
  acc[`min` + Key + `Js`] = min(val)
  acc[`max` + Key + `Js`] = max(val)
  return acc
}, {})
