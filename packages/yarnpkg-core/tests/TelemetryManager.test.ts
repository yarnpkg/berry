import {derive} from '../sources/TelemetryManager';

const hour = 60 * 60 * 1000;
const day = 24 * hour;

// Saturday, 1 January 2000 00:00:00
const TEST_TIME = 946684800000;

describe(`TelemetryManager`, () => {
  it(`should properly initialize the telemetry state`, () => {
    expect(derive({
      state: {},

      timeNow: TEST_TIME + 12 * hour,
      timeZone: 0,

      randomInitialInterval: 0,
      updateInterval: 7,
    })).toEqual({
      nextState: {lastUpdate: TEST_TIME + 12 * hour + 7 * day, lastMotd: TEST_TIME},

      triggerUpdate: false,
      triggerMotd: false,

      nextMotd: TEST_TIME,
    });
  });

  it(`shouldn't detect a MOTD display until 8am`, () => {
    expect(derive({
      state: {
        lastMotd: TEST_TIME,
      },

      timeNow: TEST_TIME + (24 + 7) * hour,
      timeZone: 0,

      randomInitialInterval: 0,
      updateInterval: 7,
    })).toEqual({
      nextState: expect.objectContaining({
        lastMotd: TEST_TIME,
      }),

      triggerUpdate: false,
      triggerMotd: false,

      nextMotd: TEST_TIME,
    });
  });

  it(`should detect a MOTD display after 8am`, () => {
    expect(derive({
      state: {
        lastMotd: TEST_TIME,
      },

      timeNow: TEST_TIME + (24 + 9) * hour,
      timeZone: 0,

      randomInitialInterval: 0,
      updateInterval: 7,
    })).toEqual({
      nextState: expect.objectContaining({
        lastMotd: TEST_TIME,
      }),

      triggerUpdate: false,
      triggerMotd: true,

      nextMotd: TEST_TIME + 24 * hour,
    });
  });

  it(`should use the local timezone when checking the MOTD display`, () => {
    expect(derive({
      state: {
        lastMotd: TEST_TIME,
      },

      timeNow: TEST_TIME + (24 + 7) * hour,
      timeZone: 2 * hour,

      randomInitialInterval: 0,
      updateInterval: 7,
    })).toEqual({
      nextState: expect.objectContaining({
        lastMotd: TEST_TIME,
      }),

      triggerUpdate: false,
      triggerMotd: true,

      nextMotd: TEST_TIME + 24 * hour,
    });
  });
});
