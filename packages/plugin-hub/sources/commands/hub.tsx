import dateformat = require('dateformat');
import React = require('react');

import {Configuration, Cache, Plugin, Project, Report} from '@berry/core';
import {Div, render}                                   from '@berry/ui';
import {hostname}                                      from 'os';

import {TopBar}                                        from '../components/TopBar';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`hub`)
  .describe(`open the project dashboard`)

  .action(async () => {
    const configuration = await Configuration.find(process.cwd(), plugins);
    const {project, workspace} = await Project.find(configuration, process.cwd());
    const cache = await Cache.find(configuration);

    const Hostname = () => {
      return `"${hostname()}"`;
    };

    const TimeWidget = () => {
      return dateformat(new Date(), `HH:MM dd-mmm-yy`);
    };

    const ProjectName = () => {
      const topLevelWorkspace = project.getWorkspaceByCwd(project.cwd);
      return topLevelWorkspace.locator.name;
    };

    const widgets = [
      Hostname,
      TimeWidget,
      ProjectName,
    ];

    await render(<Div>
      <TopBar widgets={widgets} />
    </Div>);
  });
