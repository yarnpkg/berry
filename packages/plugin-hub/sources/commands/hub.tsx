import React = require('react');

import {Configuration, Workspace, Plugin, Project} from '@berry/core';
import {Descriptor}                                from '@berry/core';
import {render}                                    from '@berry/ui';
import {DraftObject, produce}                      from 'immer';
import {Provider}                                  from 'react-redux';
import {all, put, takeEvery}                       from 'redux-saga/effects';
import createSagaMiddleware                        from 'redux-saga';
import {createStore, applyMiddleware}              from 'redux';

import {WorkspacesScreen}                          from '../screens/WorkspacesScreen';
import {Tracker, makeTracker}                      from '../makeTracker';

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
      takeEvery(`ADD_DEPENDENCY`, function* ({workspace, descriptor, kind, development}: AddDependencyAction): IterableIterator<any> {
        switch (kind) {
          case `regular`: {
            if (development) {
              yield put({type: `UPDATE_PROJECT`, project: projectTracker((project: Project) => {
                const proxyWorkspace = project.getWorkspaceByCwd(workspace.cwd);
                proxyWorkspace.manifest.dependencies.set(descriptor.descriptorHash, descriptor);
              })});
            } else {
              yield put({type: `UPDATE_PROJECT`, project: projectTracker((project: Project) => {
                const proxyWorkspace = project.getWorkspaceByCwd(workspace.cwd);
                proxyWorkspace.manifest.devDependencies.set(descriptor.descriptorHash, descriptor);
              })});
            }
          } break;

          case `peer`: {
            yield put({type: `UPDATE_PROJECT`, project: projectTracker((project: Project) => {
              const proxyWorkspace = project.getWorkspaceByCwd(workspace.cwd);
              proxyWorkspace.manifest.peerDependencies.set(descriptor.descriptorHash, descriptor);
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

    await project.resolveEverything();

    const projectTracker = makeTracker(project, {
      cwd: true,
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
