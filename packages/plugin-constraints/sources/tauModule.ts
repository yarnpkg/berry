/// <reference path="./tauProlog.d.ts"/>

import {Cache, Descriptor, miscUtils, Project, structUtils} from '@yarnpkg/core';
import {PortablePath}                                       from '@yarnpkg/fslib';
import {suggestUtils}                                       from '@yarnpkg/plugin-essentials';
import getPath                                              from 'lodash/get';
import pl                                                   from 'tau-prolog';
import vm                                                   from 'vm';

// eslint-disable-next-line @typescript-eslint/naming-convention
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

const caches = new WeakMap<pl.type.Session, Cache>();

async function getCache(thread: pl.type.Thread): Promise<Cache> {
  const project = getProject(thread);

  let cache = caches.get(thread.session);
  if (cache == null)
    caches.set(thread.session, cache = await Cache.find(project.configuration));

  return cache;
}

const tauModule = new pl.type.Module(`constraints`, {
  [`suggested_package_range/4`]: (thread, point, atom) => {
    const [workspaceCwdAtom, packageIdentAtom, packageRangeAtom, suggestedRangeVar] = atom.args;

    if (!isAtom(workspaceCwdAtom) || !isAtom(packageIdentAtom) || !isAtom(packageRangeAtom) || !isVariable(suggestedRangeVar)) {
      thread.throw_error(pl.error.instantiation(atom.indicator));
      return undefined;
    }

    const promise = Promise.resolve().then(async () => {
      const project = getProject(thread);
      const workspace = project.getWorkspaceByCwd(workspaceCwdAtom.id as any);
      const cache = await getCache(thread);

      const ident = structUtils.parseIdent(packageIdentAtom.id);
      const range = packageRangeAtom.id;

      let updated: Descriptor | null;
      try {
        updated = await suggestUtils.fetchDescriptorFrom(ident, range, {project, cache, workspace});
      } catch {
        updated = null;
      }

      return updated?.range;
    });

    const future = new pl.type.Future();

    promise.then(result => {
      future.done(new pl.type.Term(String(result)), 1);
    }, error => {
      future.done(error, 3);
    });

    thread.prepend([new pl.type.State(
      point.goal.replace(new pl.type.Term(`=`, [
        suggestedRangeVar,
        future,
      ])),
      point.substitution,
      point,
    )]);
  },

  [`project_workspaces_by_descriptor/3`]: (thread, point, atom) => {
    const [descriptorIdent, descriptorRange, workspaceCwd] = atom.args;

    if (!isAtom(descriptorIdent) || !isAtom(descriptorRange)) {
      thread.throw_error(pl.error.instantiation(atom.indicator));
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
      thread.throw_error(pl.error.instantiation(atom.indicator));
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
      // TODO: Investigate whether we should JSON.stringify primitive values too.
      // For now we don't because it would be a breaking change.
      // https://github.com/yarnpkg/berry/issues/3584
      new pl.type.Term(typeof value === `object` ? JSON.stringify(value) : value),
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
      thread.throw_error(pl.error.instantiation(atom.indicator));
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
  `suggested_package_range/4`,
  `workspace_field/3`,
  `workspace_field_test/3`,
  `workspace_field_test/4`,
]);

export function linkProjectToSession(session: pl.type.Session, project: Project) {
  projects.set(session, project);
  return `:- use_module(library(${tauModule.id})).`;
}
