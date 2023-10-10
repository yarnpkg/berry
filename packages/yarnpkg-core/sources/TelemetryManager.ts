import {xfs, PortablePath, ppath} from '@yarnpkg/fslib';

import {Configuration}            from './Configuration';
import {YarnVersion}              from './YarnVersion';
import * as hashUtils             from './hashUtils';
import * as httpUtils             from './httpUtils';
import * as miscUtils             from './miscUtils';
import * as semverUtils           from './semverUtils';

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
  lastTips?: number;
  lastUpdate?: number;
  blocks?: Record<string, RegistryBlock>;
  displayedTips?: Array<number>;
};

export type Tip = {
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

  // We reset the tips each day at 8am
  const lastTips = params.state.lastTips ?? nowDay * day;
  const nextTips = lastTips + day + 8 * hour - params.timeZone;

  const triggerUpdate = nextUpdate <= params.timeNow;
  const triggerTips = nextTips <= params.timeNow;

  let nextState: RegistryFile | null = null;

  if (triggerUpdate || triggerTips || !params.state.lastUpdate || !params.state.lastTips) {
    nextState = {};

    nextState.lastUpdate = triggerUpdate ? params.timeNow : lastUpdate;
    nextState.lastTips = lastTips;

    nextState.blocks = triggerUpdate ? {} : params.state.blocks;
    nextState.displayedTips = params.state.displayedTips;
  }

  return {nextState, triggerUpdate, triggerTips, nextTips: triggerTips ? nowDay * day : lastTips};
}

export class TelemetryManager {
  private configuration: Configuration;

  private values: Map<MetricName, Set<string>> = new Map();
  private hits: Map<MetricName, Map<string, number>> = new Map();
  private enumerators: Map<MetricName, Set<string>> = new Map();

  private nextTips: number = 0;
  private displayedTips: Array<number> = [];
  private shouldCommitTips: boolean = false;

  public isNew: boolean;
  public shouldShowTips: boolean;

  constructor(configuration: Configuration, accountId: string) {
    this.configuration = configuration;

    const registryFile = this.getRegistryPath();
    this.isNew = !xfs.existsSync(registryFile);
    this.shouldShowTips = false;

    this.sendReport(accountId);
    this.startBuffer();
  }

  /**
   * Prevents the tip from being displayed today, but doesn't actually display it.
   * We use it when replacing the tip by something else (like an upgrade prompt).
   */
  commitTips() {
    if (this.shouldShowTips) {
      this.shouldCommitTips = true;
    }
  }

  selectTip(allTips: Array<Tip | null>) {
    const displayedTips = new Set(this.displayedTips);

    const checkVersion = (selector: string | undefined) => {
      if (selector && YarnVersion) {
        return semverUtils.satisfiesWithPrereleases(YarnVersion, selector);
      } else {
        return false;
      }
    };

    // Get all possible non-null messages
    const activeTips = allTips
      .map((_, index) => index)
      .filter(index => allTips[index] && checkVersion(allTips[index]?.selector));

    if (activeTips.length === 0)
      return null;

    // Filter out the ones that have already been displayed
    let availableTips = activeTips
      .filter(index => !displayedTips.has(index));

    // If we've seen all tips, we can reset the list. We still
    // keep the last few items there, just to make sure we don't
    // immediately re-display the same tip as the last past days.
    if (availableTips.length === 0) {
      const sliceLength = Math.floor(activeTips.length * .2);

      this.displayedTips = sliceLength > 0
        ? this.displayedTips.slice(-sliceLength)
        : [];

      availableTips = activeTips
        .filter(index => !displayedTips.has(index));
    }

    const selectedTip = availableTips[Math.floor(Math.random() * availableTips.length)];
    this.displayedTips.push(selectedTip);

    this.commitTips();

    return allTips[selectedTip]!;
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
      triggerTips,

      nextTips,
    } = derive({
      state,

      timeNow: Date.now(),
      timeZone: new Date().getTimezoneOffset() * 60 * 1000,

      randomInitialInterval: Math.random(),
      updateInterval: this.configuration.get(`telemetryInterval`),
    });

    this.nextTips = nextTips;
    this.displayedTips = state.displayedTips ?? [];

    if (nextState !== null) {
      try {
        xfs.mkdirSync(ppath.dirname(registryFile), {recursive: true});
        xfs.writeJsonSync(registryFile, nextState);
      } catch {
        // In some cases this location is read-only. Too bad 🤷‍♀️
        return false;
      }
    }

    if (triggerTips && this.configuration.get(`enableTips`))
      this.shouldShowTips = true;

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

    if (this.shouldCommitTips) {
      state.lastTips = this.nextTips;
      state.displayedTips = this.displayedTips;
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
