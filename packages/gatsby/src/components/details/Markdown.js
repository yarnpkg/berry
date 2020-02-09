import 'highlight.js/styles/monokai.css';
import hljs                               from 'highlight.js';
import marked                             from 'marked';
import React                              from 'react';
import xss                                from 'xss';

import {prefixURL, isKnownRepositoryHost} from '../util';

marked.Lexer.rules.gfm.heading = marked.Lexer.rules.normal.heading;
marked.Lexer.rules.tables.heading = marked.Lexer.rules.normal.heading;

const renderAndEscapeMarkdown = ({source, repository}) => {
  const renderer = new marked.Renderer();

  if (repository && isKnownRepositoryHost(repository.host)) {
    const {user, project, path, head, host} = repository;

    const prefixImage = href =>
      host === 'github.com'
        ? prefixURL(href, {
          base: 'https://raw.githubusercontent.com',
          user,
          project,
          head: head || 'master',
          path,
        })
        : host === 'gitlab.com'
          ? prefixURL(href, {
            base: 'https://gitlab.com',
            user,
            project,
            head: `raw/${head || 'master'}`,
            path: path ? path.replace('tree', 'raw') : '',
          })
          : prefixURL(href, {
            base: 'https://bitbucket.org',
            user,
            project,
            head: `raw/${head || 'master'}`,
            path: path ? path.replace('src', 'raw') : '',
          });

    const prefixLink = href =>
      host === 'bitbucket.org'
        ? prefixURL(href, {
          base: 'https://bitbucket.org',
          user,
          project,
          head: `src/${head || 'master'}`,
          path,
        })
        : prefixURL(href, {
          // GitHub and GitLab are the same
          base: `https://${host}`,
          user,
          project,
          head: `blob/${head || 'master'}`,
          path,
        });

    // manually ask for sanitation of svgs, otherwise it will have wrong content-type
    function sanitizeSvg(href) {
      if (
        href.indexOf('//') === -1 &&
        String.prototype.endsWith &&
        href.endsWith('.svg')
      )
        return `${href}?sanitize=true`;

      return href;
    }

    renderer.image = (href, title, text) =>
      `<img src="${prefixImage(
        sanitizeSvg(href)
      )}" title="${title}" alt="${text}"/>`;

    renderer.link = (href, title, text) => {
      // No need to prefix hashes
      if (href.startsWith('#'))
        return `<a href="${href}" title="${title}">${text}</a>`;

      // wrongly linked comments
      // see https://github.com/yarnpkg/website/issues/685
      if (text.startsWith('!--'))
        return '';

      return `<a href="${prefixLink(href)}" title="${title}">${text}</a>`;
    };

    renderer.html = function(html) {
      return html.replace(
        /(src|href)="([^"]*)/g,
        (match, type, href) =>
          `${type}="${
            type === 'href' ? prefixLink(href) : prefixImage(sanitizeSvg(href))
          }`
      );
    };
  }

  renderer.code = function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const prepared = hljs.highlight(lang, code);
        return `<pre><code class="${prepared.language}">${
          prepared.value
        }</code></pre>`;
      } catch (err) {}
    }

    try {
      const prepared = hljs.highlightAuto(code);
      return `<pre><code class="${prepared.language}">${
        prepared.value
      }</code></pre>`;
    } catch (err) {}

    return `<pre><code>${code}</code></pre>`;
  };

  return xss(marked(source, {renderer, mangle: false}), {
    whiteList: {
      ...xss.getDefaultWhiteList(),
      code: ['class'],
      span: ['class'],
      h1: ['id'],
      h2: ['id'],
      h3: ['id'],
      h4: ['id'],
      h5: ['id'],
      h6: ['id'],
    },
  });
};

export const Markdown = ({source, repository}) => (
  <article
    dangerouslySetInnerHTML={{
      __html: renderAndEscapeMarkdown({
        source,
        repository,
      }),
    }}
  />
);
