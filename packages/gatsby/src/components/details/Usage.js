import React         from 'react';

import {packageLink} from '../util';

import {Di}          from './';

const deps = ({dependencies, title}) => {
  if (dependencies) {
    const dependencyNames = Object.keys(dependencies);

    return {
      title:
        dependencyNames.length > 0 ? (
          <details>
            <summary>{title}</summary>
            {dependencyNames
              .map((name, index) => (
                <a
                  href={packageLink(name)}
                  key={index}
                  title={`${name}@${dependencies[name]}`}
                >
                  {name}
                </a>
              ))
              .reduce((prev, curr) => [prev, `, `, curr])}
          </details>
        ) : (
          title
        ),
      description: dependencyNames.length,
    };
  }
  return {};
};

export const Usage = ({
  dependencies,
  devDependencies,
  versions,
  bundlesize,
  packageJSONLink,
}) => (
  <article>
    <h1>Usage</h1>
    <dl>
      <Di
        icon={`dependencies`}
        {...deps({
          title: `Dependencies`,
          dependencies,
        })}
      />
      <Di
        icon={`devdependencies`}
        {...deps({
          title: `DevDependencies`,
          dependencies: devDependencies,
        })}
      />
      {packageJSONLink && (
        <Di
          icon={`package-json`}
          title={`Packages`}
          description={
            <a target={`_blank`} rel={`noopener noreferrer`} href={packageJSONLink}>
              see package.json
            </a>
          }
        />
      )}
      {bundlesize && (
        <Di
          icon={`download-size`}
          title={`Size in browser`}
          description={
            <a
              target={`_blank`}
              rel={`noopener noreferrer`}
              href={bundlesize.href}
              title={`size: ${bundlesize.size}, gzip: ${bundlesize.gzip}`}
            >
              {bundlesize.size}
            </a>
          }
        />
      )}
    </dl>
  </article>
);
