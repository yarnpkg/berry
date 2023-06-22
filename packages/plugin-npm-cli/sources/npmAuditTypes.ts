/* eslint-disable @typescript-eslint/naming-convention */

import {Locator} from '@yarnpkg/core';

export enum Environment {
  All = `all`,
  Production = `production`,
  Development = `development`,
}

export enum Severity {
  Info = `info`,
  Low = `low`,
  Moderate = `moderate`,
  High = `high`,
  Critical = `critical`,
}

export interface AuditMetadata {
  id: number | string;
  url?: string;
  title: string;
  severity: Severity;
  vulnerable_versions: string;
}

export type AuditExtendedMetadata = AuditMetadata & {
  dependents: Array<Locator>;
  versions: Array<string>;
};

export type AuditResponse = Record<string, Array<AuditMetadata>>;
export type AuditExtendedResponse = Record<string, Array<AuditExtendedMetadata>>;
