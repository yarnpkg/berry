import {Filename, xfs, PortablePath, ppath} from '@yarnpkg/fslib';
import qs                                   from 'querystring';

import {Configuration}                      from './Configuration';
import * as miscUtils                       from './miscUtils';

export enum MetricName {
  VERSION = `version`,
  COMMAND_NAME = `commandName`,
  PLUGIN_NAME = `pluginName`,
  INSTALL_COUNT = `installCount`,
  PROJECT_COUNT = `projectCount`,
  NM_INSTALL_COUNT = `nmInstallCount`,
  WORKSPACE_COUNT = `workspaceCount`,
  DEPENDENCY_COUNT = `dependencyCount`,
  EXTENSION = `packageExtension`,
}

export type RegistryFile = {
  sendAt?: number;
  values?: {[key in MetricName]?: Array<string>};
  hits?: {[key in MetricName]?: number};
  enumerators?: {[key in MetricName]?: Array<string>};
};

export class TelemetryManager {
  private configuration: Configuration;

  private values: Map<MetricName, Set<string>> = new Map();
  private hits: Map<MetricName, number> = new Map();
  private enumerators: Map<MetricName, Set<string>> = new Map();

  constructor(configuration: Configuration, accountId: string) {
    this.configuration = configuration;

    this.sendReport(accountId);
    this.startBuffer();

    if (configuration.projectCwd !== null) {
      this.reportProject(configuration.projectCwd);
    }
  }

  reportVersion(value: string) {
    this.reportValue(MetricName.VERSION, value);
  }

  reportCommandName(value: string) {
    this.reportValue(MetricName.COMMAND_NAME, value);
  }

  reportPluginName(value: string) {
    this.reportValue(MetricName.PLUGIN_NAME, value);
  }

  reportProject(cwd: PortablePath) {
    this.reportEnumerator(MetricName.PROJECT_COUNT, cwd);
  }

  reportInstall() {
    this.reportHit(MetricName.INSTALL_COUNT);
  }

  reportNmInstall() {
    this.reportHit(MetricName.NM_INSTALL_COUNT);
  }

  reportWorkspaceCount(count: number) {
    this.reportValue(MetricName.WORKSPACE_COUNT, String(count));
  }

  reportDependencyCount(count: number) {
    this.reportValue(MetricName.DEPENDENCY_COUNT, String(count));
  }

  private reportValue(metric: MetricName, value: string) {
    miscUtils.getSetWithDefault(this.values, metric).add(value);
  }

  private reportEnumerator(metric: MetricName, value: string) {
    miscUtils.getSetWithDefault(this.enumerators, metric).add(value);
  }

  private reportHit(metric: MetricName) {
    const current = miscUtils.getFactoryWithDefault(this.hits, metric, () => 0);
    this.hits.set(metric, current + 1);
  }

  private getRegistryPath() {
    const registryFile = this.configuration.get(`globalFolder`);
    return ppath.join(registryFile, `telemetry.json` as Filename);
  }

  private sendReport(accountId: string) {
    const registryFile = this.getRegistryPath();

    let content: RegistryFile;
    try {
      content = xfs.readJsonSync(registryFile);
    } catch {
      content = {};
    }

    const now = Date.now();
    if (content.sendAt ?? 0 >= now)
      return;

    xfs.writeJsonSync(registryFile, {
      sendAt: now + 7 * 24 * 60 * 60 * 1000,
    });

    const body = qs.

      httpUtils.post(`https://www.google-analytics.com/collect`, body, {
        configuration: this.configuration,
      }).catch(error => {
      // Explicitly ignore errors
      });
  }

  private startBuffer() {
    process.on(`exit`, () => {
      try {
        const registryFile = this.getRegistryPath();

        let content: RegistryFile;
        try {
          content = xfs.readJsonSync(registryFile);
        } catch {
          content = {};
        }

        const getAllKeys = (field: keyof RegistryFile) => {
          return new Set([
            ...Object.keys(content.values ?? {}) as Array<MetricName>,
            ...this[field].keys(),
          ]);
        };

        for (const key of getAllKeys(`hits`)) {
          const store = content.hits = content.hits ?? {};
          store[key] = (store[key] ?? 0) + (this.hits.get(key) ?? 0);
        }

        for (const field of [`values`, `enumerators`] as const) {
          for (const key of getAllKeys(field)) {
            const store = content[field] = content[field] ?? {};
            store[key] = [...new Set([
              ...store[key] ?? [],
              ...this[field].get(key) ?? [],
            ])];
          }
        }

        xfs.writeJsonSync(registryFile, content);
      } catch {
        // Explicitly ignore errors
      }
    });
  }
}
