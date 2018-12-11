import React = require('react');

import {Configuration, Workspace, Plugin, Project} from '@berry/core';
import {Descriptor}                                from '@berry/core';
import {LinkType}                                  from '@berry/core';
import {structUtils}                               from '@berry/core';
import {Tracker, makeTracker}                      from '@berry/json-proxy';
import {render}                                    from '@berry/ui';
import {DraftObject, produce}                      from 'immer';
import {Provider}                                  from 'react-redux';
import {all, put, takeEvery}                       from 'redux-saga/effects';
import createSagaMiddleware                        from 'redux-saga';
import {createStore, applyMiddleware}              from 'redux';

import {WorkspacesScreen}                          from '../screens/WorkspacesScreen';

export type State = {
  project: Project,
};

export type AddDependencyAction = {
  type: `ADD_DEPENDENCY`,

  workspace: Workspace,
  descriptor: Descriptor,

  kind: `regular` | `peer`,
  development: boolean,
};

export type UpdateResolutionAction = {
  type: `UPDATE_RESOLUTION`,

  descriptor: Descriptor,

  reference: string,
};

export type UpdateProjectAction = {
  type: `UPDATE_PROJECT`,

  project: Project,
};

export type Action =
  AddDependencyAction |
  UpdateProjectAction;

function makeBerrySaga(projectTracker: Tracker<Project>) {
  return function* berrySaga() {
    yield all([
      takeEvery(`UPDATE_RESOLUTION`, function* ({descriptor, reference}: UpdateResolutionAction): IterableIterator<any> {
        yield put({type: `UPDATE_PROJECT`, project: projectTracker(project => {
          const locator = structUtils.makeLocator(descriptor, reference);

          const languageName = ``;
          const linkType = LinkType.HARD;

          const dependencies = new Map();
          const peerDependencies = new Map();

          project.storedResolutions.set(descriptor.descriptorHash, locator.locatorHash);
          project.storedPackages.set(locator.locatorHash, {... locator, languageName, linkType, dependencies, peerDependencies});
        })});
      }),
      takeEvery(`ADD_DEPENDENCY`, function* ({workspace, descriptor, kind, development}: AddDependencyAction): IterableIterator<any> {
        switch (kind) {
          case `regular`: {
            if (development) {
              yield put({type: `UPDATE_PROJECT`, project: projectTracker((project: Project) => {
                const proxyWorkspace = project.getWorkspaceByCwd(workspace.cwd);
                proxyWorkspace.manifest.dependencies.set(descriptor.identHash, descriptor);
              })});
            } else {
              yield put({type: `UPDATE_PROJECT`, project: projectTracker((project: Project) => {
                const proxyWorkspace = project.getWorkspaceByCwd(workspace.cwd);
                proxyWorkspace.manifest.devDependencies.set(descriptor.identHash, descriptor);
              })});
            }
          } break;

          case `peer`: {
            yield put({type: `UPDATE_PROJECT`, project: projectTracker((project: Project) => {
              const proxyWorkspace = project.getWorkspaceByCwd(workspace.cwd);
              proxyWorkspace.manifest.peerDependencies.set(descriptor.identHash, descriptor);
            })});
          } break;
        }
      }),
    ]);
  };
}

function projectReducer(state: State | undefined, action: Action): State {
  if (!state)
    throw new Error(`The initial state shouldn't be empty`);

  return produce(state, (draft: DraftObject<State>) => {
    switch (action.type) {
      case `UPDATE_PROJECT`: {
        draft.project = action.project;
      } break;
    }
  });
}

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`hub`)
  .describe(`open the project dashboard`)

  .action(async () => {
    const configuration = await Configuration.find(process.cwd(), plugins);
    const {project} = await Project.find(configuration, process.cwd());

    const projectTracker = makeTracker(project, {
      cwd: true,
      storedResolutions: true,
      storedPackages: true,
      workspacesByCwd: {
        locator: true,
        manifest: true,
      }
    });

    const sagaMiddleware = createSagaMiddleware();
    const reduxStore = createStore(projectReducer, {project: projectTracker.immutable}, applyMiddleware(sagaMiddleware));

    sagaMiddleware.run(makeBerrySaga(projectTracker.open));

    await render(<Provider store={reduxStore}>
      <WorkspacesScreen />
    </Provider>);
  });
