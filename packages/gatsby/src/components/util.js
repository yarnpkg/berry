import React                                from 'react';
import fetch                                from 'unfetch';
import marked                               from 'marked';
import xss                                  from 'xss';
import unescape                             from 'unescape-html';
import { HIGHLIGHT_TAGS, connectHighlight } from 'react-instantsearch-dom';
import styled                               from '@emotion/styled';
import {withPrefix}                         from 'gatsby'

import IcoTag                               from '../images/search/ico-tag.svg'

export const isEmpty = item => typeof item === 'undefined' || item.length < 1;

export const encode = val => encodeURIComponent(val);

export function getDownloadBucket(dl) {
  if (dl < 1000) {
    return null;
  } else if (dl < 5000) {
    return 'hot-t1';
  } else if (dl < 25000) {
    return 'hot-t2';
  } else if (dl < 1000000) {
    return 'hot-t3';
  } else {
    return 'hot-t4';
  }
}

const HitKeywords = styled.span`
  font-size: 0.825rem;
  color: rgba(0,0,0,0.5);
  font-style: italic;
  &:before {
    display: inline-block;
    content: '';
    background: url(${IcoTag}) no-repeat;
    width: 16px;
    height: 8px;
    margin-right: 4px;
    opacity: 0.5;
  }
`;

export const Keywords = ({ name, keywords = [], maxKeywords = 4 }) => {
  return isEmpty(keywords) ? null : (
    <HitKeywords>
      {keywords
        .slice(0, maxKeywords)
        .map(keyword => (
          <a
            href={`${withPrefix('/')}?q=${' '}&keywords%5B0%5D=${keyword}`}
            key={`${name}-${keyword}`}
          >
            {keyword}
          </a>
        ))
        .reduce((prev, curr) => [prev, ', ', curr])}
    </HitKeywords>
  );
};

export function formatKeywords(
  keywords = [],
  highlightedKeywords = [],
  maxKeywords = 4,
  onClick
) {
  if (isEmpty(keywords)) return keywords;
  highlightedKeywords.forEach((el, i) => {
    el.originalValue = keywords[i];
  });
  return highlightedKeywords
    .sort((k1, k2) => {
      // sort keywords by match level
      if (k1.matchLevel !== k2.matchLevel) {
        if (k1.matchLevel === 'full') return -1;
        if (k2.matchLevel === 'full') return 1;
        return k1.matchLevel === 'partial' ? -1 : 1;
      }
      if (k1.matchedWords.length !== k2.matchedWords.length) {
        return k2.matchedWords.length - k1.matchedWords.length;
      }
      if (k1.matchedWords.join('').length !== k2.matchedWords.join('').length) {
        return (
          k2.matchedWords.join('').length - k1.matchedWords.join('').length
        );
      }
      return 0;
    })
    .slice(0, maxKeywords)
    .map(
      ({ value: highlightedKeyword, originalValue: keyword }, keywordIndex) => {
        const highlighted = parseHighlightedAttribute({
          highlightedValue: highlightedKeyword,
        });
        const content = highlighted.map((v, i) => {
          const key = `split-${i}-${v.value}`;
          if (v.isHighlighted) {
            return (
              <em key={key}>
                {v.value}
              </em>
            );
          }
          return (
            <span key={key}>
              {v.value}
            </span>
          );
        });
        return (
          <span
            key={`${keyword}${keywordIndex}`}
            onClick={() => onClick(keyword)}
          >
            {content}
          </span>
        );
      }
    )
    .reduce((prev, curr) => [prev, ', ', curr]);
}

function parseHighlightedAttribute({
  preTag = HIGHLIGHT_TAGS.highlightPreTag,
  postTag = HIGHLIGHT_TAGS.highlightPostTag,
  highlightedValue,
}) {
  const splitByPreTag = highlightedValue.split(preTag);
  const firstValue = splitByPreTag.shift();
  const elements =
    firstValue === '' ? [] : [{ value: firstValue, isHighlighted: false }];

  if (postTag === preTag) {
    let isHighlighted = true;
    splitByPreTag.forEach(split => {
      elements.push({ value: split, isHighlighted });
      isHighlighted = !isHighlighted;
    });
  } else {
    splitByPreTag.forEach(split => {
      const splitByPostTag = split.split(postTag);
      elements.push({
        value: splitByPostTag[0],
        isHighlighted: true,
      });

      if (splitByPostTag[1] !== '') {
        elements.push({
          value: splitByPostTag[1],
          isHighlighted: false,
        });
      }
    });
  }

  return elements;
}

export const packageJSONLink = packageName => ({
  packageJSONLink: `https://cdn.jsdelivr.net/npm/${packageName}/package.json`,
});

export const packageLink = (name, prefix = true) =>
  `${prefix ? withPrefix('/package/') : '/package/'}?${name}`;

export const prefixURL = (url, { base, user, project, head, path }) => {
  if (url.indexOf('//') > 0) {
    return url;
  } else {
    return new URL(
      (path ? path.replace(/^\//, '') + '/' : '') +
        url.replace(/^(\.?\/?)/, ''),
      `${base}/${user}/${project}/${path ? '' : `${head}/`}`
    );
  }
};

const status = res =>
  new Promise((resolve, reject) => {
    if (res.status >= 200 && res.status < 300) {
      // GitHub will return status 202 or 204 if things like contributor activity are
      // valid, but not yet computed, and will return an empty response
      if (res.status === 202 || res.status === 204) {
        reject(res);
      }
      resolve(res);
    } else {
      reject(res);
    }
  });

export const get = ({ url, type, headers, ...rest }) =>
  fetch(url, { headers, ...rest })
    .then(status)
    .then(res => res[type]())
    .catch(err => {
      // in case it's a useless response by GitHub, tell the caller to retry
      if (err.status === 202 || err.status === 204) {
        throw new Error('retry');
      } else {
        console.warn(err);
      }
    });

export const HighlightedMarkdown = connectHighlight(
  ({ highlight, attribute, hit }) => (
    <span>
      {highlight({
        attribute,
        hit,
        highlightProperty: '_highlightResult',
      }).map(
        (v, i) =>
          v.isHighlighted ? (
            <em
              key={`split-${i}-${v.value}`}
              dangerouslySetInnerHTML={safeMarkdown(v.value)}
            />
          ) : (
            <span
              key={`split-${i}-${v.value}`}
              dangerouslySetInnerHTML={safeMarkdown(v.value)}
            />
          )
      )}
    </span>
  )
);

const inlineRenderer = new marked.Renderer();
inlineRenderer.paragraph = function(text) {
  return text;
};

export const safeMarkdown = input => ({
  __html: xss(marked(unescape(input), { renderer: inlineRenderer })) || ' ',
});

// Contains the repositories that we know how to handle
const knownRepositoryHosts = new Set([
  'github.com',
  'gitlab.com',
  'bitbucket.org',
]);

export const isKnownRepositoryHost = host => knownRepositoryHosts.has(host);
