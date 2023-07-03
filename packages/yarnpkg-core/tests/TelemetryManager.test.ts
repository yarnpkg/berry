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
      nextState: {lastUpdate: TEST_TIME + 12 * hour + 7 * day, lastTips: TEST_TIME},

      triggerUpdate: false,
      triggerTips: false,

      nextTips: TEST_TIME,
    });
  });

  it(`shouldn't detect a tips display until 8am`, () => {
    expect(derive({
      state: {
        lastTips: TEST_TIME,
      },

      timeNow: TEST_TIME + (24 + 7) * hour,
      timeZone: 0,

      randomInitialInterval: 0,
      updateInterval: 7,
    })).toEqual({
      nextState: expect.objectContaining({
        lastTips: TEST_TIME,
      }),

      triggerUpdate: false,
      triggerTips: false,

      nextTips: TEST_TIME,
    });
  });

  it(`should detect a tips display after 8am`, () => {
    expect(derive({
      state: {
        lastTips: TEST_TIME,
      },

      timeNow: TEST_TIME + (24 + 9) * hour,
      timeZone: 0,

      randomInitialInterval: 0,
      updateInterval: 7,
    })).toEqual({
      nextState: expect.objectContaining({
        lastTips: TEST_TIME,
      }),

      triggerUpdate: false,
      triggerTips: true,

      nextTips: TEST_TIME + 24 * hour,
    });
  });

  it(`should use the local timezone when checking the tips display`, () => {
    expect(derive({
      state: {
        lastTips: TEST_TIME,
      },

      timeNow: TEST_TIME + (24 + 7) * hour,
      timeZone: 2 * hour,

      randomInitialInterval: 0,
      updateInterval: 7,
    })).toEqual({
      nextState: expect.objectContaining({
        lastTips: TEST_TIME,
      }),

      triggerUpdate: false,
      triggerTips: true,

      nextTips: TEST_TIME + 24 * hour,
    });
  });
});
