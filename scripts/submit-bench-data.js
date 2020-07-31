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

for (const entry of benchmarkEntries) {
  const subtestName = entry.match(BENCHMARK)[1];

  const data = JSON.parse(fs.readFileSync(path.join(benchDir, entry), `utf8`));
  const points = data.results[0].times.map((timing, t) => [now + t * 10, timing]);

  const mean = points.reduce((acc, point) => acc + point[1], 0) / points.length;
  if (mean !== data.results[0].mean)
    throw new Error(`Invalid data extraction (${mean} instead of ${data.results[0].mean})`);

  series.push({
    metric: `perftest.duration`,
    tags: [`pm:${packageManager}`, `test:${testName}`, `subtest:${subtestName}`],
  });
}

if (process.env.DD_API_KEY) {
  const req = https.request(`https://api.datadoghq.com/api/v1/series?api_key=${process.env.DD_API_KEY}`, {
    method: `POST`,
    headers: {
      [`Content-Type`]: `application/json`,
    },
  }, res => {
    console.log(`Data submitted; received status ${res.statusCode}`);
    res.resume();
  });

  req.on(`error`, e => {
    console.error(`problem with request: ${e.message}`);
  });

  req.write(JSON.stringify({series}));
  req.end();
}
