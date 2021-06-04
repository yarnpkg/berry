import {Filename, xfs, PortablePath, ppath} from '@yarnpkg/fslib';

import {Configuration}                      from './Configuration';
import * as hashUtils                       from './hashUtils';
import * as httpUtils                       from './httpUtils';
import * as miscUtils                       from './miscUtils';

export enum MetricName {
  VERSION = `version`,
  COMMAND_NAME = `commandName`,
  PLUGIN_NAME = `pluginName`,
  INSTALL_COUNT = `installCount`,
  PROJECT_COUNT = `projectCount`,
  WORKSPACE_COUNT = `workspaceCount`,
  DEPENDENCY_COUNT = `dependencyCount`,
  EXTENSION = `packageExtension`,
}

export type RegistryBlock = {
  values?: {[key in MetricName]?: Array<string>};
  hits?: {[key in MetricName]?: {[extra: string]: number}};
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
  private hits: Map<MetricName, Map<string, number>> = new Map();
  private enumerators: Map<MetricName, Set<string>> = new Map();

  public isNew: boolean;

  constructor(configuration: Configuration, accountId: string) {
    this.configuration = configuration;

    const registryFile = this.getRegistryPath();
    this.isNew = !xfs.existsSync(registryFile);

    this.sendReport(accountId);
    this.startBuffer();
  }

  reportVersion(value: string) {
    // We don't really care about the exact commit they're using
    this.reportValue(MetricName.VERSION, value.replace(/-git\..*/, `-git`));
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

  reportInstall(nodeLinker: string) {
    this.reportHit(MetricName.INSTALL_COUNT, nodeLinker);
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
    miscUtils.getSetWithDefault(this.values, metric).add(value);
  }

  private reportEnumerator(metric: MetricName, value: string) {
    miscUtils.getSetWithDefault(this.enumerators, metric).add(hashUtils.makeHash(value));
  }

  private reportHit(metric: MetricName, extra: string = `*`) {
    const ns = miscUtils.getMapWithDefault(this.hits, metric);
    const current = miscUtils.getFactoryWithDefault(ns, extra, () => 0);
    ns.set(extra, current + 1);
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
    const interval = this.configuration.get(`telemetryInterval`) * 24 * 60 * 60 * 1000;

    const lastUpdate = content.lastUpdate ?? now + interval + Math.floor(interval * Math.random());
    const nextUpdate = lastUpdate + interval;

    if (nextUpdate > now && content.lastUpdate != null)
      return;

    try {
      xfs.mkdirSync(ppath.dirname(registryFile), {recursive: true});
      xfs.writeJsonSync(registryFile, {lastUpdate: now});
    } catch {
      // In some cases this location is read-only. Too bad 🤷‍♀️
      return;
    }

    if (nextUpdate > now)
      return;

    if (!content.blocks)
      return;

    const rawUrl = `https://browser-http-intake.logs.datadoghq.eu/v1/input/${accountId}?ddsource=yarn`;
    const sendPayload = (payload: any) => httpUtils.post(rawUrl, payload, {
      configuration: this.configuration,
    }).catch(() => {
      // Nothing we can do
    });

    for (const [userId, block] of Object.entries(content.blocks ?? {})) {
      if (Object.keys(block).length === 0)
        continue;

      const upload: any = block;
      upload.userId = userId;
      upload.reportType = `primary`;

      for (const key of Object.keys(upload.enumerators ?? {}))
        upload.enumerators[key] = upload.enumerators[key].length;

      sendPayload(upload);

      // Datadog doesn't support well sending multiple tags in a single
      // payload, so we instead send them separately, at most one value
      // per query (we still aggregate different tags together).
      const toSend = new Map();

      // Also the max amount of queries (at worst once a week, remember)
      const maxValues = 20;

      for (const [metricName, values] of Object.entries<any>(upload.values))
        if (values.length > 0)
          toSend.set(metricName, values.slice(0, maxValues));

      while (toSend.size > 0) {
        const upload: any = {};
        upload.userId = userId;
        upload.reportType = `secondary`;
        upload.metrics = {};

        for (const [metricName, values] of toSend) {
          upload.metrics[metricName] = values.shift();
          if (values.length === 0) {
            toSend.delete(metricName);
          }
        }

        sendPayload(upload);
      }
    }
  }

  private applyChanges() {
    const registryFile = this.getRegistryPath();

    let content: RegistryFile;
    try {
      content = xfs.readJsonSync(registryFile);
    } catch {
      content = {};
    }

    const userId = this.configuration.get(`telemetryUserId`) ?? `*`;

    const blocks = content.blocks = content.blocks ?? {};
    const block = blocks[userId] = blocks[userId] ?? {};

    for (const key of this.hits.keys()) {
      const store = block.hits = block.hits ?? {};
      const ns = store[key] = store[key] ?? {};

      for (const [extra, value] of this.hits.get(key)!) {
        ns[extra] = (ns[extra] ?? 0) + value;
      }
    }

    for (const field of [`values`, `enumerators`] as const) {
      for (const key of this[field].keys()) {
        const store = block[field] = block[field] ?? {};

        store[key] = [...new Set([
          ...store[key] ?? [],
          ...this[field].get(key) ?? [],
        ])];
      }
    }

    xfs.mkdirSync(ppath.dirname(registryFile), {recursive: true});
    xfs.writeJsonSync(registryFile, content);
  }

  private startBuffer() {
    process.on(`exit`, () => {
      try {
        this.applyChanges();
      } catch {
        // Explicitly ignore errors
      }
    });
  }
}
