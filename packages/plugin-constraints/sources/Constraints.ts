import {Ident, MessageName, Project, ReportError, Workspace} from '@berry/core';
import {miscUtils, structUtils}                              from '@berry/core';
import {xfs}                                                 from '@berry/fslib';
import {posix}                                               from 'path';
import pl                                                    from 'tau-prolog';
import {runInNewContext}                                     from 'vm';

import {linkProjectToSession}                                from './tauModule';

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

function clearerError(tauErr: any) {
  let prologCode = String(tauErr);
  prologCode = prologCode.replace(/^throw\(/g, `_throw(`);
  prologCode = prologCode.replace(/'\/'\(([^,]+)/g, `slashfn('$1'`);

  const clearerErr = runInNewContext(prologCode, {
    [`_throw`]: (err: Error) => err,
    [`error`]: (err: Error, args: Array<any>) => Object.assign(err, ... args),
    [`syntax_error`]: (reason: string) => new ReportError(MessageName.PROLOG_SYNTAX_ERROR, `Syntax error: ${reason}`),
    [`existence_error`]: (type: string, description: string) => new ReportError(MessageName.PROLOG_EXISTENCE_ERROR, `Existence error: ${type} ${description} doesn't exist`),
    [`slashfn`]:  (name: string, arity: number) => `${name}/${arity}`,
    [`line`]: (line: number) => ({line}),
    [`column`]: (column: number) => ({column}),
    [`procedure`]: `procedure`,
    [`top_level`]: `top level`,
    [`found`]: () => ({}),
    [`token_not_found`]: ({}),
  });

  if (typeof clearerErr === `undefined`)
    return new ReportError(MessageName.PROLOG_UNKNOWN_ERROR, prologCode);

  if (typeof clearerErr.line !== `undefined` && typeof clearerErr.column !== `undefined`)
    clearerErr.message += ` at line ${clearerErr.line}, column ${clearerErr.column}`;

  return clearerErr;
}

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
    const parsed = this.session.query(query) as any;

    if (parsed !== true)
      throw clearerError(parsed);

    while (true) {
      const answer = await this.fetchNextAnswer();

      if (!answer)
        break;

      if (answer.id === `throw`)
        throw clearerError(answer);

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
      const relativeCwd = workspace.relativeCwd;

      database += `workspace(${escape(relativeCwd)}).\n`;
      database += `workspace_ident(${escape(relativeCwd)}, ${escape(structUtils.stringifyIdent(workspace.locator))}).\n`
      database += `workspace_version(${escape(relativeCwd)}, ${escape(workspace.manifest.version)}).\n`

      for (const dependencyType of DEPENDENCY_TYPES) {
        for (const dependency of workspace.manifest[dependencyType].values()) {
          database += `workspace_has_dependency(${escape(relativeCwd)}, ${escape(structUtils.stringifyIdent(dependency))}, ${escape(dependency.range)}, ${dependencyType}).\n`;
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

    // (Cwd, Path, Value)
    declarations += `gen_workspace_field_requirement(_, _, _) :- false.\n`;

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
      const workspaceCwd = posix.resolve(this.project.cwd, parseLink(answer.links.WorkspaceCwd));
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
      const workspaceCwd = posix.resolve(this.project.cwd, parseLink(answer.links.WorkspaceCwd));
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

    let workspaceFieldRequirements: Array<{
      workspace: Workspace,
      fieldPath: string,
      fieldValue: string|null,
    }> = [];

    for await (const answer of session.makeQuery(`workspace(WorkspaceCwd), gen_workspace_field_requirement(WorkspaceCwd, FieldPath, FieldValue).`)) {
      const workspaceCwd = posix.resolve(this.project.cwd, parseLink(answer.links.WorkspaceCwd));
      const fieldPath = parseLink(answer.links.FieldPath);
      const fieldValue = parseLink(answer.links.FieldValue);

      if (workspaceCwd === null || fieldPath === null)
        throw new Error(`Invalid rule`);

      const workspace = this.project.getWorkspaceByCwd(workspaceCwd);

      workspaceFieldRequirements.push({workspace, fieldPath, fieldValue});
    }

    workspaceFieldRequirements = miscUtils.sortMap(workspaceFieldRequirements, [
      ({workspace}) => structUtils.stringifyIdent(workspace.locator),
      ({fieldPath}) => fieldPath,
    ]);

    return {enforcedDependencyRanges, invalidDependencies, workspaceFieldRequirements};
  }

  async *query(query: string) {
    const session = this.createSession();

    for await (const answer of session.makeQuery(query)) {
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
