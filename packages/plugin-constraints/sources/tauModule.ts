import {Project} from '@berry/core';
import pl        from 'tau-prolog';

const {is_atom} = pl.type;

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

    if (!is_atom(workspaceCwd) || !is_atom(fieldName)) {
      thread.throwError(pl.error.instantiation(atom.indicator));
      return;
    }

    const project = getProject(thread);
    const workspace = project.tryWorkspaceByCwd(workspaceCwd.id);

    // Workspace not found => this predicate can never match
    // We might want to throw here? We can be pretty sure the user did
    // something wrong at this point
    if (workspace == null)
      return;

    const manifest: {[key: string]: any} = workspace.manifest.raw!;

    // Field is not present => this predicate can never match
    if (!(fieldName.id in manifest))
      return;

    prependGoals(thread, point, [new pl.type.Term('=', [
      fieldValue,
      new pl.type.Term(String((manifest)[fieldName.id])),
    ])]);
  },
}, [
  `workspace_field/3`,
]);

export function linkProjectToSession(session: pl.type.Session, project: Project) {
  projects.set(session, project);

  session.consult(`:- use_module(library(${tauModule.id})).`);
}
