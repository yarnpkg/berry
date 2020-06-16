/// <reference path="./tauProlog.d.ts"/>

import {Project, structUtils} from '@yarnpkg/core';
import {PortablePath}         from '@yarnpkg/fslib';
import getPath                from 'lodash/get';
import pl                     from 'tau-prolog';
import vm                     from 'vm';

// eslint-disable-next-line @typescript-eslint/camelcase
const {is_atom: isAtom, is_variable: isVariable, is_instantiated_list: isInstantiatedList} = pl.type;

function prependGoals(thread: pl.type.Thread, point: pl.type.State, goals: Array<pl.type.Term<number, string>>): void {
  thread.prepend(goals.map(
    goal => new pl.type.State(
      point.goal.replace(goal),
      point.substitution,
      point,
    ),
  ));
}

const projects = new WeakMap<pl.type.Session, Project>();

function getProject(thread: pl.type.Thread): Project {
  const project = projects.get(thread.session);

  if (project == null)
    throw new Error(`Assertion failed: A project should have been registered for the active session`);

  return project;
}

const tauModule = new pl.type.Module(`constraints`, {
  [`project_workspaces_by_descriptor/3`]: (thread, point, atom) => {
    const [descriptorIdent, descriptorRange, workspaceCwd] = atom.args;

    if (!isAtom(descriptorIdent) || !isAtom(descriptorRange)) {
      thread.throwError(pl.error.instantiation(atom.indicator));
      return;
    }

    const ident = structUtils.parseIdent(descriptorIdent.id);
    const descriptor = structUtils.makeDescriptor(ident, descriptorRange.id);

    const project = getProject(thread);
    const workspace = project.tryWorkspaceByDescriptor(descriptor);

    if (isVariable(workspaceCwd)) {
      if (workspace !== null) {
        prependGoals(thread, point, [new pl.type.Term(`=`, [
          workspaceCwd,
          new pl.type.Term(String(workspace.relativeCwd)),
        ])]);
      }
    }

    if (isAtom(workspaceCwd)) {
      if (workspace !== null && workspace.relativeCwd === workspaceCwd.id) {
        thread.success(point);
      }
    }
  },

  [`workspace_field/3`]: (thread, point, atom) => {
    const [workspaceCwd, fieldName, fieldValue] = atom.args;

    if (!isAtom(workspaceCwd) || !isAtom(fieldName)) {
      thread.throwError(pl.error.instantiation(atom.indicator));
      return;
    }

    const project = getProject(thread);
    const workspace = project.tryWorkspaceByCwd(workspaceCwd.id as PortablePath);

    // Workspace not found => this predicate can never match
    // We might want to throw here? We can be pretty sure the user did
    // something wrong at this point
    if (workspace == null)
      return;

    const value = getPath(workspace.manifest.raw!, fieldName.id);

    // Field is not present => this predicate can never match
    if (typeof value === `undefined`)
      return;

    prependGoals(thread, point, [new pl.type.Term(`=`, [
      fieldValue,
      new pl.type.Term(String(value)),
    ])]);
  },

  [`workspace_field_test/3`]: (thread, point, atom) => {
    const [workspaceCwd, fieldName, checkCode] = atom.args;

    thread.prepend([new pl.type.State(
      point.goal.replace(new pl.type.Term(`workspace_field_test`, [
        workspaceCwd,
        fieldName,
        checkCode,
        new pl.type.Term(`[]`, []),
      ])),
      point.substitution,
      point,
    )]);
  },

  [`workspace_field_test/4`]: (thread, point, atom) => {
    const [workspaceCwd, fieldName, checkCode, checkArgv] = atom.args;

    if (!isAtom(workspaceCwd) || !isAtom(fieldName) || !isAtom(checkCode) || !isInstantiatedList(checkArgv)) {
      thread.throwError(pl.error.instantiation(atom.indicator));
      return;
    }

    const project = getProject(thread);
    const workspace = project.tryWorkspaceByCwd(workspaceCwd.id as PortablePath);

    // Workspace not found => this predicate can never match
    // We might want to throw here? We can be pretty sure the user did
    // something wrong at this point
    if (workspace == null)
      return;

    const value = getPath(workspace.manifest.raw!, fieldName.id);

    // Field is not present => this predicate can never match
    if (typeof value === `undefined`)
      return;

    // Inject the variables into a sandbox
    const vars: {[key: string]: any} = {$$: value};
    for (const [index, value] of (checkArgv.toJavaScript() as Array<string>).entries())
      vars[`$${index}`] = value;

    const result = vm.runInNewContext(checkCode.id, vars);

    if (result) {
      thread.success(point);
    }
  },
}, [
  `project_workspaces_by_descriptor/3`,
  `workspace_field/3`,
  `workspace_field_test/3`,
  `workspace_field_test/4`,
]);

export function linkProjectToSession(session: pl.type.Session, project: Project) {
  projects.set(session, project);

  session.consult(`:- use_module(library(${tauModule.id})).`);
}
