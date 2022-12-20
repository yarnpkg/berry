import MarkdownIt from 'markdown-it';
import React      from 'react';

const md = new MarkdownIt();

export const descriptionRenderer = {
  render: (text: string) => <div dangerouslySetInnerHTML={{__html: md.render(text)}}/>,
};
