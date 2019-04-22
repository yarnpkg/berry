import {Ident, Locator, Project, Workspace} from '@berry/core';
import {miscUtils, structUtils}             from '@berry/core';
import {xfs}                                from '@berry/fslib';
import pl                                   from 'tau-prolog';

import {linkProjectToSession}               from './tauModule';

export type DependencyMismatch = {
  packageLocator: Locator,
  dependencyIdent: Ident,
  expectedResolution: string,
};

export type ConstraintReport = {
  mismatchingDependencies: Array<DependencyMismatch>,
};

export const enum DependencyType {
  Dependencies = 'dependencies',
  DevDependencies = 'devDependencies',
  PeerDependencies = 'peerDependencies',
}

const DEPENDENCY_TYPES = [
  DependencyType.Dependencies,
  DependencyType.DevDependencies,
  DependencyType.PeerDependencies,
];

// Node 8 doesn't have Symbol.asyncIterator
// https://github.com/Microsoft/TypeScript/issues/14151#issuecomment-280812617
if (Symbol.asyncIterator == null)
  (Symbol as any).asyncIterator = Symbol.for('Symbol.asyncIterator');

class Session {
  private readonly session: pl.type.Session;

  public constructor(project: Project, source: string) {
    this.session = pl.create();
    linkProjectToSession(this.session, project);

    this.session.consult(source);
  }

  private fetchNextAnswer() {
    return new Promise<pl.Answer>(resolve => {
      this.session.answer((result: any) => {
        resolve(result);
      });
    });
  }

  public async *makeQuery(query: string) {
    this.session.query(query);

    while (true) {
      const answer = await this.fetchNextAnswer();

      if (!answer)
        break;

      yield answer;
    }
  }
}

function parseLink(link: pl.Link): string|null {
  if (link.id === `null`) {
    return null;
  } else {
    return `${link.toJavaScript()}`;
  }
}

export class Constraints {
  public readonly project: Project;

  public readonly source: string = ``;

  static async find(project: Project) {
    return new Constraints(project);
  }

  constructor(project: Project) {
    this.project = project;

    if (xfs.existsSync(`${project.cwd}/constraints.pro`)) {
      this.source = xfs.readFileSync(`${project.cwd}/constraints.pro`, `utf8`);
    }
  }

  getProjectDatabase() {
    let database = ``;

    for (const dependencyType of DEPENDENCY_TYPES)
      database += `dependency_type(${dependencyType}).\n`

    for (const workspace of this.project.workspacesByCwd.values()) {
      database += `workspace(${escape(workspace.cwd)}).\n`;
      database += `workspace_ident(${escape(workspace.cwd)}, ${escape(structUtils.stringifyIdent(workspace.locator))}).\n`
      database += `workspace_version(${escape(workspace.cwd)}, ${escape(workspace.manifest.version)}).\n`

      for (const dependencyType of DEPENDENCY_TYPES) {
        for (const dependency of workspace.manifest[dependencyType].values()) {
          database += `workspace_has_dependency(${escape(workspace.cwd)}, ${escape(structUtils.stringifyIdent(dependency))}, ${escape(dependency.range)}, ${dependencyType}).\n`;
        }
      }
    }

    // Add default never matching predicates to prevent prolog instantiation errors
    // when constraints run in an empty workspace
    database += `workspace(_) :- false.\n`;
    database += `workspace_ident(_, _) :- false.\n`;
    database += `workspace_version(_, _) :- false.\n`;

    // Add a default never matching predicate to prevent prolog instantiation errors
    // when constraints run in a workspace without dependencies
    database += `workspace_has_dependency(_, _, _, _) :- false.\n`;

    return database;
  }

  getDeclarations() {
    let declarations = ``;

    // (Cwd, DependencyIdent, DependencyRange, DependencyType)
    declarations += `gen_enforced_dependency_range(_, _, _, _) :- false.\n`;

    // (Cwd, DependencyIdent, DependencyType, Reason)
    declarations += `gen_invalid_dependency(_, _, _, _) :- false.\n`;

    return declarations;
  }

  get fullSource() {
    return this.getProjectDatabase() + `\n` + this.source + `\n` + this.getDeclarations();
  }

  private createSession() {
    return new Session(this.project, this.fullSource);
  }

  async process() {
    const session = this.createSession();

    let enforcedDependencyRanges: Array<{
      workspace: Workspace,
      dependencyIdent: Ident,
      dependencyRange: string | null,
      dependencyType: DependencyType,
    }> = [];

    for await (const answer of session.makeQuery(`workspace(WorkspaceCwd), dependency_type(DependencyType), gen_enforced_dependency_range(WorkspaceCwd, DependencyIdent, DependencyRange, DependencyType).`)) {
      if (answer.id === `throw`)
        throw new Error(pl.format_answer(answer));

      const workspaceCwd = parseLink(answer.links.WorkspaceCwd);
      const dependencyRawIdent = parseLink(answer.links.DependencyIdent);
      const dependencyRange = parseLink(answer.links.DependencyRange);
      const dependencyType = parseLink(answer.links.DependencyType) as DependencyType;

      if (workspaceCwd === null || dependencyRawIdent === null)
        throw new Error(`Invalid rule`);

      const workspace = this.project.getWorkspaceByCwd(workspaceCwd);
      const dependencyIdent = structUtils.parseIdent(dependencyRawIdent);
      
      enforcedDependencyRanges.push({workspace, dependencyIdent, dependencyRange, dependencyType});
    }

    enforcedDependencyRanges = miscUtils.sortMap(enforcedDependencyRanges, [
      ({dependencyRange}) => dependencyRange !== null ? `0` : `1`,
      ({workspace}) => structUtils.stringifyIdent(workspace.locator),
      ({dependencyIdent}) => structUtils.stringifyIdent(dependencyIdent),
    ]);

    let invalidDependencies: Array<{
      workspace: Workspace,
      dependencyIdent: Ident,
      dependencyType: DependencyType,
      reason: string | null,
    }> = [];

    for await (const answer of session.makeQuery(`workspace(WorkspaceCwd), dependency_type(DependencyType), gen_invalid_dependency(WorkspaceCwd, DependencyIdent, DependencyType, Reason).`)) {
      if (answer.id === `throw`)
        throw new Error(pl.format_answer(answer));

      const workspaceCwd = parseLink(answer.links.WorkspaceCwd);
      const dependencyRawIdent = parseLink(answer.links.DependencyIdent);
      const dependencyType = parseLink(answer.links.DependencyType) as DependencyType;
      const reason = parseLink(answer.links.Reason);

      if (workspaceCwd === null || dependencyRawIdent === null)
        throw new Error(`Invalid rule`);

      const workspace = this.project.getWorkspaceByCwd(workspaceCwd);
      const dependencyIdent = structUtils.parseIdent(dependencyRawIdent);

      invalidDependencies.push({workspace, dependencyIdent, dependencyType, reason});
    }

    invalidDependencies = miscUtils.sortMap(invalidDependencies, [
      ({workspace}) => structUtils.stringifyIdent(workspace.locator),
      ({dependencyIdent}) => structUtils.stringifyIdent(dependencyIdent),
    ]);

    return {enforcedDependencyRanges, invalidDependencies};
  }

  async *query(query: string) {
    const session = this.createSession();

    for await (const answer of session.makeQuery(query)) {
      if (answer.id === `throw`)
        throw new Error(pl.format_answer(answer));

      const parsedLinks: Record<string, string|null> = {};

      for (const [variable, value] of Object.entries(answer.links)) {
        if (variable !== `_`) {
          parsedLinks[variable] = parseLink(value);
        }
      }

      yield parsedLinks;
    }
  }
}

function escape(what: string | null) {
  if (typeof what === `string`) {
    return `'${what}'`;
  } else {
    return `[]`;
  }
}
