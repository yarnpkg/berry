import {Configuration, formatUtils, Manifest, miscUtils, nodeUtils, Project, treeUtils, Workspace} from '@yarnpkg/core';
import {PortablePath}                                                                              from '@yarnpkg/fslib';
import get                                                                                         from 'lodash/get';
import set                                                                                         from 'lodash/set';
import toPath                                                                                      from 'lodash/toPath';
import unset                                                                                       from 'lodash/unset';

export type ProcessResult = {
  manifestUpdates: Map<PortablePath, Map<string, Map<any, Set<nodeUtils.Caller>>>>;
  reportedErrors: Map<PortablePath, Array<string>>;
};

export interface Engine {
  process(): Promise<ProcessResult | null>;
}

export class Index<T extends {[key: string]: any}> {
  private items: Array<T> = [];

  private indexes: {
    [K in keyof T]?: Map<any, Array<T>>;
  } = {};

  constructor(private indexedFields: Array<keyof T>) {
    this.clear();
  }

  clear() {
    this.items = [];

    for (const field of this.indexedFields) {
      this.indexes[field] = new Map();
    }
  }

  insert(item: T) {
    this.items.push(item);

    for (const field of this.indexedFields) {
      const value = Object.hasOwn(item, field)
        ? item[field]
        : undefined;

      if (typeof value === `undefined`)
        continue;

      const list = miscUtils.getArrayWithDefault(this.indexes[field]!, value);
      list.push(item);
    }

    return item;
  }

  find(filter?: {[K in keyof T]?: any}) {
    if (typeof filter === `undefined`)
      return this.items;

    const filterEntries = Object.entries(filter);
    if (filterEntries.length === 0)
      return this.items;

    const sequentialFilters: Array<[keyof T, any]> = [];

    let matches: Set<T> | undefined;
    for (const [field_, value] of filterEntries) {
      const field = field_ as keyof T;

      const index = Object.hasOwn(this.indexes, field)
        ? this.indexes[field]
        : undefined;

      if (typeof index === `undefined`) {
        sequentialFilters.push([field, value]);
        continue;
      }

      const filterMatches = new Set(index.get(value) ?? []);
      if (filterMatches.size === 0)
        return [];

      if (typeof matches === `undefined`) {
        matches = filterMatches;
      } else {
        for (const item of matches) {
          if (!filterMatches.has(item)) {
            matches.delete(item);
          }
        }
      }

      if (matches.size === 0) {
        break;
      }
    }

    let result = [...matches ?? []];
    if (sequentialFilters.length > 0) {
      result = result.filter(item => {
        for (const [field, value] of sequentialFilters) {
          const valid = typeof value !== `undefined`
            ? Object.hasOwn(item, field) && item[field] === value
            : Object.hasOwn(item, field) === false;

          if (!valid) {
            return false;
          }
        }

        return true;
      });
    }

    return result;
  }
}

const numberRegExp = /^[0-9]+$/;
const identifierRegExp = /^[a-zA-Z0-9_]+$/;
const knownDictKeys = new Set<string>([`scripts`, ...Manifest.allDependencies]);

function isKnownDict(parts: Array<string>, index: number) {
  return index === 1 && knownDictKeys.has(parts[0]);
}

export function normalizePath(p: Array<string> | string) {
  const parts = Array.isArray(p)
    ? p
    : toPath(p);

  const normalizedParts = parts.map((part, t) => {
    if (numberRegExp.test(part))
      return `[${part}]`;

    if (identifierRegExp.test(part) && !isKnownDict(parts, t))
      return `.${part}`;

    return `[${JSON.stringify(part)}]`;
  });

  return normalizedParts.join(``).replace(/^\./, ``);
}

function formatStackLine(configuration: Configuration, caller: nodeUtils.Caller) {
  // TODO: Should this be in formatUtils? Might not be super useful as a core feature...
  const parts: Array<string> = [];

  if (caller.methodName !== null)
    parts.push(formatUtils.pretty(configuration, caller.methodName, formatUtils.Type.CODE));

  if (caller.file !== null) {
    const fileParts: Array<string> = [];
    fileParts.push(formatUtils.pretty(configuration, caller.file, formatUtils.Type.PATH));

    if (caller.line !== null) {
      fileParts.push(formatUtils.pretty(configuration, caller.line, formatUtils.Type.NUMBER));

      if (caller.column !== null) {
        fileParts.push(formatUtils.pretty(configuration, caller.column, formatUtils.Type.NUMBER));
      }
    }

    parts.push(`(${fileParts.join(formatUtils.pretty(configuration, `:`, `grey`))})`);
  }

  return parts.join(` `);
}

export type AnnotatedError = {
  text: string;
  fixable: boolean;
};

export function applyEngineReport(project: Project, {manifestUpdates, reportedErrors}: ProcessResult, {fix}: {fix?: boolean} = {}) {
  const changedWorkspaces = new Map<Workspace, Record<string, any>>();
  const remainingErrors = new Map<Workspace, Array<AnnotatedError>>();

  const errorEntries = [...reportedErrors.keys()]
    .map(workspaceCwd => [workspaceCwd, new Map()] as const);

  for (const [workspaceCwd, workspaceUpdates] of [...errorEntries, ...manifestUpdates]) {
    const workspaceErrors = reportedErrors.get(workspaceCwd)?.map(text => ({text, fixable: false})) ?? [];
    let changedWorkspace = false;

    const workspace = project.getWorkspaceByCwd(workspaceCwd);
    const manifest = workspace.manifest.exportTo({});

    for (const [fieldPath, newValues] of workspaceUpdates) {
      if (newValues.size > 1) {
        const conflictingValuesMessage = [...newValues].map(([value, sources]) => {
          const prettyValue = formatUtils.pretty(project.configuration, value, formatUtils.Type.INSPECT);

          const stackLine = sources.size > 0
            ? formatStackLine(project.configuration, sources.values().next().value)
            : null;

          return stackLine !== null
            ? `\n${prettyValue} at ${stackLine}`
            : `\n${prettyValue}`;
        }).join(``);

        workspaceErrors.push({text: `Conflict detected in constraint targeting ${formatUtils.pretty(project.configuration, fieldPath, formatUtils.Type.CODE)}; conflicting values are:${conflictingValuesMessage}`, fixable: false});
      } else {
        const [[newValue]] = newValues;

        const currentValue = get(manifest, fieldPath);
        if (currentValue === newValue)
          continue;

        if (!fix) {
          const errorMessage = typeof currentValue === `undefined`
            ? `Missing field ${formatUtils.pretty(project.configuration, fieldPath, formatUtils.Type.CODE)}; expected ${formatUtils.pretty(project.configuration, newValue, formatUtils.Type.INSPECT)}`
            : typeof newValue === `undefined`
              ? `Extraneous field ${formatUtils.pretty(project.configuration, fieldPath, formatUtils.Type.CODE)} currently set to ${formatUtils.pretty(project.configuration, currentValue, formatUtils.Type.INSPECT)}`
              : `Invalid field ${formatUtils.pretty(project.configuration, fieldPath, formatUtils.Type.CODE)}; expected ${formatUtils.pretty(project.configuration, newValue, formatUtils.Type.INSPECT)}, found ${formatUtils.pretty(project.configuration, currentValue, formatUtils.Type.INSPECT)}`;

          workspaceErrors.push({text: errorMessage, fixable: true});
          continue;
        }

        if (typeof newValue === `undefined`)
          unset(manifest, fieldPath);
        else
          set(manifest, fieldPath, newValue);

        changedWorkspace = true;
      }

      if (changedWorkspace) {
        changedWorkspaces.set(workspace, manifest);
      }
    }

    if (workspaceErrors.length > 0) {
      remainingErrors.set(workspace, workspaceErrors);
    }
  }

  return {
    changedWorkspaces,
    remainingErrors,
  };
}

export function convertReportToRoot(errors: Map<Workspace, Array<AnnotatedError>>, {configuration}: {configuration: Configuration}) {
  const root: treeUtils.TreeRoot = {children: []};

  for (const [workspace, workspaceErrors] of errors) {
    const errorNodes: Array<treeUtils.TreeNode> = [];
    for (const error of workspaceErrors) {
      const lines = error.text.split(/\n/);

      if (error.fixable)
        lines[0] = `${formatUtils.pretty(configuration, `⚙`, `gray`)} ${lines[0]}`;

      errorNodes.push({
        value: formatUtils.tuple(formatUtils.Type.NO_HINT, lines[0]),
        children: lines.slice(1).map(line => ({
          value: formatUtils.tuple(formatUtils.Type.NO_HINT, line),
        })),
      });
    }

    const workspaceNode: treeUtils.TreeNode = {
      value: formatUtils.tuple(formatUtils.Type.LOCATOR, workspace.anchoredLocator),
      children: miscUtils.sortMap(errorNodes, node => node.value![1]),
    };

    root.children.push(workspaceNode);
  }

  root.children = miscUtils.sortMap(root.children, node => {
    return node.value![1];
  });

  return root;
}
