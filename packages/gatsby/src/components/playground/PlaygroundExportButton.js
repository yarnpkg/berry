import 'rc-dropdown/assets/index.css';
import Dropdown                          from 'rc-dropdown';
import Menu, {Item as MenuItem, Divider} from 'rc-menu';
import React                             from 'react';

import * as playgroundUtils              from '../../utils/playgroundUtils';

import PlaygroundButton                  from './PlaygroundButton';
import {REPO_URL, LABELS}                from './constants';


const PlaygroundExportButton = ({input, output, label}) => {
  const exportMenu = (
    <Menu selectable={false}>
      <MenuItem
        disabled={label !== LABELS.REPRODUCIBLE}
        onClick={async () => {
          const bugReport = await playgroundUtils.getFilledGithubBugReportTemplate(input, output);
          playgroundUtils.openUrl(`${REPO_URL}/issues/new?assignees=&labels=bug&template=bug-report.md&title=%5BBug%5D&body=${encodeURIComponent(bugReport)}`);
        }}
      >
        Report issue on GitHub
      </MenuItem>

      <MenuItem
        disabled={label !== LABELS.REPRODUCIBLE}
        onClick={async () => {
          const bugReport = await playgroundUtils.getFilledGithubBugReportTemplate(input, output);
          playgroundUtils.copyToClipboard(bugReport);
        }}
      >
        Copy as Markdown Issue
      </MenuItem>

      <Divider />

      <MenuItem onClick={() => {
        const link = playgroundUtils.getShareableUrl(input);
        playgroundUtils.copyToClipboard(link);
      }}>
        Copy as Raw Link
      </MenuItem>

      <MenuItem onClick={() => {
        const link = playgroundUtils.getShareableMarkdownLink(input);
        playgroundUtils.copyToClipboard(link);
      }}>
        Copy as Markdown Link
      </MenuItem>

      <MenuItem onClick={() => {
        const linkWithPreview = playgroundUtils.getShareableMarkdownDigest(input, output);
        playgroundUtils.copyToClipboard(linkWithPreview);
      }}>
        Copy as Markdown Link with Preview and Output
      </MenuItem>

      <Divider />

      <MenuItem onClick={async () => {
        const {url} = await playgroundUtils.createSandbox(input);
        playgroundUtils.openUrl(url);
      }}>
        Open in CodeSandbox
      </MenuItem>
    </Menu>
  );

  return (
    <Dropdown trigger={[`click`]} overlay={exportMenu}>
      <PlaygroundButton children={`Export`} />
    </Dropdown>
  );
};

// eslint-disable-next-line arca/no-default-export
export default PlaygroundExportButton;
