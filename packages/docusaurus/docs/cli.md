---
slug: /cli
title: CLI Reference
description: List of commands distributed with Yarn.
---

import Link          from '@docusaurus/Link';
import {commandList} from '@yarnpkg/docusaurus/docs/generated/commandList';
import groupBy       from 'lodash/groupBy';

<div>
  {Object.entries(groupBy(commandList, command => command.category ?? `General commands`)).map(([category, commands]) => <>
    <h2>{category}</h2>
    <table key={category}>
      <colgroup>
        <col width={280}/>
      </colgroup>
      <tbody>
        {commands.map(command => <tr key={command.id}>
          <td><Link href={command.docusaurus.slug}>{command.docusaurus.title}</Link></td>
          <td>{command.docusaurus.description}</td>
        </tr>)}
      </tbody>
    </table>
  </>)}
</div>
