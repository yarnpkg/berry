import {Ident, Descriptor, Locator, Project} from '@berry/core';
import {miscUtils, structUtils}              from '@berry/core';
import {existsSync, readFileSync}            from 'fs';
// @ts-ignore
import pl                                    from 'tau-prolog';

export type DependencyMismatch = {
  packageLocator: Locator,
  dependencyIdent: Ident,
  expectedResolution: string,
};

export type ConstraintReport = {
  mismatchingDependencies: Array<DependencyMismatch>,
};

export class Constraints {
  public readonly project: Project;

  public readonly source: string = ``;

  static async find(project: Project) {
    return new Constraints(project);
  }

  constructor(project: Project) {
    this.project = project;

    if (existsSync(`${project.cwd}/constraints.pro`)) {
      this.source = readFileSync(`${project.cwd}/constraints.pro`, `utf8`);
    }
  }

  getProjectDatabase() {
    let database = ``;

    for (const workspace of this.project.workspacesByCwd.values()) {
      database += `is_workspace(${escape(structUtils.stringifyIdent(workspace.locator))}, ${escape(workspace.locator.reference)}, ${escape(workspace.cwd)}).\n`;

      for (const dependency of workspace.manifest.dependencies.values()) {
        database += `described_dependency(${escape(structUtils.stringifyIdent(workspace.locator))}, ${escape(workspace.locator.reference)}, ${escape(structUtils.stringifyIdent(dependency))}, ${escape(dependency.range)}).\n`;
      }
    }

    return database;
  }

  getDeclarations() {
    let declarations = ``;

    declarations += `enforced_dependency_range(_, _, _, _) :- false.\n`;
    declarations += `invalid_dependency(_, _, _, _, _) :- false.\n`;

    return declarations;
  }

  get fullSource() {
    return this.getProjectDatabase() + `\n` + this.source + `\n` + this.getDeclarations();
  }

  async process() {
    const session = pl.create();
    session.consult(this.fullSource);

    let enforcedDependencyRanges: Array<{
      packageLocator: Locator,
      dependencyIdent: Ident,
      dependencyRange: string | null,
    }> = [];

    for (const answer of await makeQuery(`is_workspace(PackageIdent, PackageReference, _), enforced_dependency_range(PackageIdent, PackageReference, DependencyIdent, DependencyRange).`)) {
      if (answer.id === `throw`)
        throw new Error(pl.format_answer(answer));

      const packageRawIdent = parseLink(answer.links.PackageIdent);
      const packageReference = parseLink(answer.links.PackageReference);
      const dependencyRawIdent = parseLink(answer.links.DependencyIdent);
      const dependencyRange = parseLink(answer.links.DependencyRange);

      if (packageRawIdent === null || packageReference === null || dependencyRawIdent === null)
        throw new Error(`Invalid rule`);

      const packageIdent = structUtils.parseIdent(packageRawIdent);
      const dependencyIdent = structUtils.parseIdent(dependencyRawIdent);
      
      const packageLocator = structUtils.makeLocator(packageIdent, packageReference);

      enforcedDependencyRanges.push({packageLocator, dependencyIdent, dependencyRange});
    }

    enforcedDependencyRanges = miscUtils.sortMap(enforcedDependencyRanges, [
      ({dependencyRange}) => dependencyRange !== null ? `0` : `1`,
      ({dependencyIdent}) => structUtils.stringifyIdent(dependencyIdent),
      ({packageLocator}) => structUtils.stringifyLocator(packageLocator),
    ]);

    let invalidDependencies: Array<{
      packageLocator: Locator,
      dependencyDescriptor: Descriptor,
      reason: string | null,
    }> = [];

    for (const answer of await makeQuery(`is_workspace(PackageIdent, PackageReference, _), invalid_dependency(PackageIdent, PackageReference, DependencyIdent, DependencyRange, Reason).`)) {
      if (answer.id === `throw`)
        throw new Error(pl.format_answer(answer));

      const packageRawIdent = parseLink(answer.links.PackageIdent);
      const packageReference = parseLink(answer.links.PackageReference);
      const dependencyRawIdent = parseLink(answer.links.DependencyIdent);
      const dependencyRange = parseLink(answer.links.DependencyRange);
      const reason = parseLink(answer.links.Reason);

      if (packageRawIdent === null || packageReference === null || dependencyRawIdent === null || dependencyRange === null)
        throw new Error(`Invalid rule`);

      const packageIdent = structUtils.parseIdent(packageRawIdent);
      const dependencyIdent = structUtils.parseIdent(dependencyRawIdent);
      
      const packageLocator = structUtils.makeLocator(packageIdent, packageReference);
      const dependencyDescriptor = structUtils.makeDescriptor(dependencyIdent, dependencyRange);

      invalidDependencies.push({packageLocator, dependencyDescriptor, reason});
    }

    invalidDependencies = miscUtils.sortMap(invalidDependencies, [
      ({dependencyDescriptor}) => structUtils.stringifyDescriptor(dependencyDescriptor),
      ({packageLocator}) => structUtils.stringifyLocator(packageLocator),
    ]);

    return {enforcedDependencyRanges, invalidDependencies};

    function parseLink(link: any) {
      if (link.id === `null`) {
        return null;
      } else {
        return String.fromCharCode(... link.toJavaScript());
      }
    }

    function fetchNextAnswer() {
      return new Promise<any>(resolve => {
        session.answer((result: any) => {
          resolve(result);
        });
      });
    }

    async function accumulateAnswers() {
      const answers = [];

      while (true) {
        const answer = await fetchNextAnswer();

        if (!answer)
          break;

        answers.push(answer);
      }

      return answers;
    }

    function makeQuery(query: string) {
      session.query(query);

      return accumulateAnswers();
    }
  }
}

function escape(what: string | undefined) {
  if (typeof what === `string`) {
    return JSON.stringify(what);
  } else {
    return `[]`;
  }
}
