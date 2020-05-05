const React = require(`react`);

exports.onRenderBody = ({setHeadComponents, setPostBodyComponents}, {specs = []}) => {
  specs = specs.filter(spec => {
    return spec.apiKey && spec.indexName && spec.inputSelector;
  });

  if (specs.length === 0)
    return;

  setHeadComponents([
    React.createElement(`link`, {
      key: `plugin-docsearch-css`,
      rel: `stylesheet`,
      href: `https://cdn.jsdelivr.net/npm/docsearch.js@2/dist/cdn/docsearch.min.css`,
    }),
  ]);

  setPostBodyComponents([
    React.createElement(`script`, {
      key: `plugin-docsearch-js`,
      type: `text/javascript`,
      src: `https://cdn.jsdelivr.net/npm/docsearch.js@2/dist/cdn/docsearch.min.js`,
    }),
    ...specs.map(({apiKey, indexName, inputSelector, debug = false}) => (
      React.createElement(`script`, {
        key: `plugin-docsearch-initiate`,
        type: `text/javascript`,
        dangerouslySetInnerHTML: {
          __html: `{
            let docuSearchElem;

            const observer = new MutationObserver((mutations, instance) => {
              const previousElem = docuSearchElem;

              docuSearchElem = document.querySelector(${JSON.stringify(inputSelector)});
              if (!docuSearchElem || docuSearchElem === previousElem)
                return;

              docsearch({
                apiKey: ${JSON.stringify(apiKey)},
                indexName: ${JSON.stringify(indexName)},
                inputSelector: ${JSON.stringify(inputSelector)},
                debug: ${JSON.stringify(debug)}
              });
            });

            // start observing
            document.addEventListener("DOMContentLoaded", () => {
              observer.observe(document, {
                childList: true,
                subtree: true
              });
            });
          }`,
        },
      })
    )),
  ]);
};
