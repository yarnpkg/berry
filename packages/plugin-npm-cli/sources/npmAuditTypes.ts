/* eslint-disable @typescript-eslint/naming-convention */

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

export interface AuditResolution {
  id: number;
  path: string;
  dev: boolean;
  optional: boolean;
  bundled: boolean;
}

export interface AuditAction {
  action: string;
  module: string;
  target: string;
  isMajor: boolean;
  resolves: Array<AuditResolution>;
}

export interface AuditAdvisory {
  findings: Array<{
    version: string;
    paths: Array<string>;
    dev: boolean;
    optional: boolean;
    bundled: boolean;
  }>;
  id: number;
  created: string;
  updated: string;
  deleted?: boolean;
  title: string;
  found_by: {
    name: string;
  };
  reported_by: {
    name: string;
  };
  module_name: string;
  cves: Array<string>;
  vulnerable_versions: string;
  patched_versions: string;
  overview: string;
  recommendation: string;
  references: string;
  access: string;
  severity: string;
  cwe: string;
  metadata: {
    module_type: string;
    exploitability: number;
    affected_components: string;
  };
  url: string;
}

export type AuditVulnerabilities = {
  [severity in Severity]: number;
};

export interface AuditMetadata {
  vulnerabilities: AuditVulnerabilities;
  dependencies: number;
  devDependencies: number;
  optionalDependencies: number;
  totalDependencies: number;
}

export interface AuditResponse {
  actions: Array<AuditAction>;
  advisories: { [key: string]: AuditAdvisory };
  muted: Array<Object>;
  metadata: AuditMetadata;
}
