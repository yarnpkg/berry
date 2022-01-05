export type SiteMetadata = {
  title: string;
  description: string;
  author: string;
};

export type Site = {
  siteMetadata: SiteMetadata;
};

export type Query = {
  site: Site;
};
