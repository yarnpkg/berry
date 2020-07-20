import {Filename, xfs, PortablePath, ppath} from '@yarnpkg/fslib';

import {Configuration}                      from './Configuration';
import * as httpUtils                       from './httpUtils';
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

export type RegistryBlock = {
  values?: {[key in MetricName]?: Array<string>};
  hits?: {[key in MetricName]?: number};
  enumerators?: {[key in MetricName]?: Array<string>};
};

export type RegistryFile = {
  lastUpdate?: number;
  blocks?: {
    [userId: string]: RegistryBlock;
  };
};

export class TelemetryManager {
  private configuration: Configuration;

  private values: Map<MetricName, Set<string>> = new Map();
  private hits: Map<MetricName, number> = new Map();
  private enumerators: Map<MetricName, Set<string>> = new Map();

  public isNew: boolean;

  constructor(configuration: Configuration, accountId: string) {
    this.configuration = configuration;

    const registryFile = this.getRegistryPath();
    this.isNew = !xfs.existsSync(registryFile);

    this.sendReport(accountId);
    this.startBuffer();
  }

  get enabled() {
    return this.configuration.get<boolean>(`enableTelemetry`);
  }

  reportVersion(value: string) {
    this.reportValue(MetricName.VERSION, value);
  }

  reportCommandName(value: string) {
    this.reportValue(MetricName.COMMAND_NAME, value || `<none>`);
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

  reportPackageExtension(value: string) {
    this.reportValue(MetricName.EXTENSION, value);
  }

  reportWorkspaceCount(count: number) {
    this.reportValue(MetricName.WORKSPACE_COUNT, String(count));
  }

  reportDependencyCount(count: number) {
    this.reportValue(MetricName.DEPENDENCY_COUNT, String(count));
  }

  private reportValue(metric: MetricName, value: string) {
    if (!this.enabled)
      return;

    miscUtils.getSetWithDefault(this.values, metric).add(value);
  }

  private reportEnumerator(metric: MetricName, value: string) {
    if (!this.enabled)
      return;

    miscUtils.getSetWithDefault(this.enumerators, metric).add(value);
  }

  private reportHit(metric: MetricName) {
    if (!this.enabled)
      return;

    const current = miscUtils.getFactoryWithDefault(this.hits, metric, () => 0);
    this.hits.set(metric, current + 1);
  }

  private getRegistryPath() {
    const registryFile = this.configuration.get(`globalFolder`);
    return ppath.join(registryFile, `telemetry.json` as Filename);
  }

  private sendReport(accountId: string) {
    if (!this.enabled)
      return;

    const registryFile = this.getRegistryPath();

    let content: RegistryFile;
    try {
      content = xfs.readJsonSync(registryFile);
    } catch {
      content = {};
    }

    const now = Date.now();
    const interval = this.configuration.get<number>(`telemetryInterval`) * 24 * 60 * 60 * 1000;

    const lastUpdate = content.lastUpdate ?? now - Math.floor(interval * Math.random());
    const nextUpdate = lastUpdate + interval;

    if (nextUpdate > now && content.lastUpdate != null)
      return;

    xfs.writeJsonSync(registryFile, {
      lastUpdate: now,
    });

    if (nextUpdate > now)
      return;

    if (!content.blocks)
      return;

    for (const [userId, block] of Object.entries(content.blocks ?? {})) {
      if (Object.keys(block).length === 0)
        continue;

      const upload: any = block;
      upload.userId = userId;

      for (const key of Object.keys(upload.enumerators ?? {}))
        upload.enumerators = upload.enumerators[key].length;

      const rawUrl = `https://browser-http-intake.logs.datadoghq.eu/v1/input/${accountId}?ddsource=yarn`;

      httpUtils.post(rawUrl, upload, {
        configuration: this.configuration,
      }).catch(() => {
        // Nothing we can do
      });
    }
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

        const userId = this.configuration.get<string | null>(`telemetryUserId`) ?? `*`;

        const blocks = content.blocks = content.blocks ?? {};
        const block = blocks[userId] = blocks[userId] ?? {};

        const getAllKeys = (field: keyof RegistryBlock) => {
          return new Set([
            ...Object.keys(block[field] ?? {}) as Array<MetricName>,
            ...this[field].keys(),
          ]);
        };

        for (const key of getAllKeys(`hits`)) {
          const store = block.hits = block.hits ?? {};
          store[key] = (store[key] ?? 0) + (this.hits.get(key) ?? 0);
        }

        for (const field of [`values`, `enumerators`] as const) {
          for (const key of getAllKeys(field)) {
            const store = block[field] = block[field] ?? {};
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
