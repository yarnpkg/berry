import {YarnVersion, semverUtils} from '@yarnpkg/core';
import {xfs, PortablePath, ppath} from '@yarnpkg/fslib';

import {Configuration}            from './Configuration';
import * as hashUtils             from './hashUtils';
import * as httpUtils             from './httpUtils';
import * as miscUtils             from './miscUtils';

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
  lastMotd?: number;
  lastUpdate?: number;
  blocks?: Record<string, RegistryBlock>;
  displayedMotd?: Array<number>;
};

export type Motd = {
  selector?: string;
  message: string;
  url?: string;
};

export type DeriveParameters = {
  state: RegistryFile;

  timeNow: number;
  timeZone: number;

  randomInitialInterval: number;
  updateInterval: number;
};

export function derive(params: DeriveParameters) {
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  const nowDay = Math.floor(params.timeNow / day);
  const updateIntervalMs = params.updateInterval * day;

  const lastUpdate = params.state.lastUpdate ?? params.timeNow + updateIntervalMs + Math.floor(updateIntervalMs * params.randomInitialInterval);
  const nextUpdate = lastUpdate + updateIntervalMs;

  // We reset the motd each day at 8am
  const lastMotd = params.state.lastMotd ?? nowDay * day;
  const nextMotd = lastMotd + day + 8 * hour - params.timeZone;

  const triggerUpdate = nextUpdate <= params.timeNow;
  const triggerMotd = nextMotd <= params.timeNow;

  let nextState: RegistryFile | null = null;

  if (triggerUpdate || triggerMotd || !params.state.lastUpdate || !params.state.lastMotd) {
    nextState = {};

    nextState.lastUpdate = triggerUpdate ? params.timeNow : lastUpdate;
    nextState.lastMotd = lastMotd;

    nextState.blocks = triggerUpdate ? {} : params.state.blocks;
    nextState.displayedMotd = params.state.displayedMotd;
  }

  return {nextState, triggerUpdate, triggerMotd, nextMotd: triggerMotd ? nowDay * day : lastMotd};
}

export class TelemetryManager {
  private configuration: Configuration;

  private values: Map<MetricName, Set<string>> = new Map();
  private hits: Map<MetricName, Map<string, number>> = new Map();
  private enumerators: Map<MetricName, Set<string>> = new Map();

  private nextMotd: number = 0;
  private displayedMotd: Array<number> = [];
  private shouldCommitMotd: boolean = false;

  public isNew: boolean;
  public isMotd: boolean;

  constructor(configuration: Configuration, accountId: string) {
    this.configuration = configuration;

    const registryFile = this.getRegistryPath();
    this.isNew = !xfs.existsSync(registryFile);
    this.isMotd = false;

    this.sendReport(accountId);
    this.startBuffer();
  }

  /**
   * Prevent the motd to be displayed today, but doesn't actually display it.
   * We use it when we replaced the motd by something else (like an upgrade prompt).
   */
  commitMotd() {
    if (this.isMotd) {
      this.shouldCommitMotd = true;
    }
  }

  selectMotd(allMotds: Array<Motd | null>) {
    const displayedMotd = new Set(this.displayedMotd);

    const checkVersion = (selector: string | undefined) => {
      if (selector && YarnVersion) {
        return semverUtils.satisfiesWithPrereleases(YarnVersion, selector);
      } else {
        return false;
      }
    };

    // Get all possible non-null messages
    const activeMotds = allMotds
      .map((_, index) => index)
      .filter(index => allMotds[index] && checkVersion(allMotds[index]?.selector));

    if (activeMotds.length === 0)
      return null;

    // Filter out the ones that have already been displayed
    let availableMotds = activeMotds
      .filter(index => !displayedMotd.has(index));

    // If we've seen all motd, we can reset the list. We still
    // keep the last few items there, just to make sure we don't
    // immediately re-display the same motd as the last past days.
    if (availableMotds.length === 0) {
      const sliceLength = Math.floor(activeMotds.length * .2);

      this.displayedMotd = sliceLength > 0
        ? this.displayedMotd.slice(-sliceLength)
        : [];

      availableMotds = activeMotds
        .filter(index => !displayedMotd.has(index));
    }

    const selectedMotd = availableMotds[Math.floor(Math.random() * availableMotds.length)];
    this.displayedMotd.push(selectedMotd);

    this.commitMotd();

    return allMotds[selectedMotd]!;
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
    return ppath.join(registryFile, `telemetry.json`);
  }

  private sendReport(accountId: string) {
    const registryFile = this.getRegistryPath();

    let state: RegistryFile;
    try {
      state = xfs.readJsonSync(registryFile);
    } catch {
      state = {};
    }

    const {
      nextState,

      triggerUpdate,
      triggerMotd,

      nextMotd,
    } = derive({
      state,

      timeNow: Date.now(),
      timeZone: new Date().getTimezoneOffset() * 60 * 1000,

      randomInitialInterval: Math.random(),
      updateInterval: this.configuration.get(`telemetryInterval`),
    });

    this.nextMotd = nextMotd;
    this.displayedMotd = state.displayedMotd ?? [];

    if (nextState !== null) {
      try {
        xfs.mkdirSync(ppath.dirname(registryFile), {recursive: true});
        xfs.writeJsonSync(registryFile, nextState);
      } catch {
        // In some cases this location is read-only. Too bad 🤷‍♀️
        return false;
      }
    }

    if (triggerMotd && this.configuration.get(`enableMotd`))
      this.isMotd = true;

    if (triggerUpdate) {
      const blocks = state.blocks ?? {};

      if (Object.keys(blocks).length === 0) {
        const rawUrl = `https://browser-http-intake.logs.datadoghq.eu/v1/input/${accountId}?ddsource=yarn`;
        const sendPayload = (payload: any) => httpUtils.post(rawUrl, payload, {
          configuration: this.configuration,
        }).catch(() => {
          // Nothing we can do
        });

        for (const [userId, block] of Object.entries(state.blocks ?? {})) {
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
    }

    return true;
  }

  private applyChanges() {
    const registryFile = this.getRegistryPath();

    let state: RegistryFile;
    try {
      state = xfs.readJsonSync(registryFile);
    } catch {
      state = {};
    }

    const userId = this.configuration.get(`telemetryUserId`) ?? `*`;

    const blocks = state.blocks = state.blocks ?? {};
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

    if (this.shouldCommitMotd) {
      state.lastMotd = this.nextMotd;
      state.displayedMotd = this.displayedMotd;
    }

    xfs.mkdirSync(ppath.dirname(registryFile), {recursive: true});
    xfs.writeJsonSync(registryFile, state);
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
