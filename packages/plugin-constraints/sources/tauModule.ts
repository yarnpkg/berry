import {Project}      from '@yarnpkg/core';
import {PortablePath} from '@yarnpkg/fslib';
import getPath        from 'lodash/get';
import pl             from 'tau-prolog';

// eslint-disable-next-line @typescript-eslint/camelcase
const {is_atom: isAtom} = pl.type;

function prependGoals(thread: pl.type.Thread, point: pl.type.State, goals: pl.type.Term<number, string>[]): void {
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
}, [
  `workspace_field/3`,
]);

export function linkProjectToSession(session: pl.type.Session, project: Project) {
  projects.set(session, project);

  session.consult(`:- use_module(library(${tauModule.id})).`);
}
