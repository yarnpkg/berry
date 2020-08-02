const fs = require(`fs`);
const https = require(`https`);
const path = require(`path`);

const packageManager = process.argv[2];
const testName = process.argv[3];

const benchDir = process.argv[4];
const entries = fs.readdirSync(benchDir);

const BENCHMARK = /^bench-(.*)\.json$/;
const benchmarkEntries = entries.filter(entry => {
  return entry.match(BENCHMARK);
});

const now = Math.floor(Date.now() / 1000);
const series = [];

if (process.env.GITHUB_EVENT_PATH)
  console.log(fs.readFileSync(process.env.GITHUB_EVENT_PATH, `utf8`));

for (const entry of benchmarkEntries) {
  const subtestName = entry.match(BENCHMARK)[1];

  const data = JSON.parse(fs.readFileSync(path.join(benchDir, entry), `utf8`));
  const points = [[now, data.results[0].mean]];

  series.push({
    metric: `perftest.duration`,
    type: `gauge`,
    tags: [`pm:${packageManager}`, `test:${testName}`, `subtest:${subtestName}`, `iteration:3`],
    points: points.map(([timestamp, value]) => [timestamp, value]),
  });
}

if (process.env.DD_API_KEY) {
  const data = JSON.stringify({series}, null, 2);

  const req = https.request(`https://api.datadoghq.eu/api/v1/series?api_key=${process.env.DD_API_KEY}`, {
    method: `POST`,
    headers: {
      [`Content-Type`]: `application/json`,
    },
  }, res => {
    console.log(`Data submitted; received status ${res.statusCode}`);
    console.log(data);
    res.resume();
  });

  req.on(`error`, e => {
    console.error(`problem with request: ${e.message}`);
  });

  req.write(data);
  req.end();
}
