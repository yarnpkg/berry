const {readFileSync} = require(`fs`);
const GitHub = require(`github-api`);

const gh = new GitHub({
  token: process.env.GITHUB_API_TOKEN,
});

const buildUrl = `${process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI}/${process.env.SYSTEM_TEAMPROJECT}/_build/results?buildId=${process.env.BUILD_BUILDID}&_a=summary`;
const buildStatus = readFileSync(process.env.REPORT_PATH, `utf8`).trim().split(`\n`).map(line => JSON.parse(line));

const issues = gh.getIssues(`yarnpkg`, `berry`);

issues.listIssues({
  filter: `created`,
  labels: `e2e`,
}).then(async ({data}) => {
  const create = [];

  const idByTitle = new Map();
  const numberById = new Map();

  for (const {id, number, title} of data) {
    idByTitle.set(title, id);
    numberById.set(id, number);
  }

  const resolved = new Set(numberById.keys());

  for (const {name, failed} of buildStatus) {
    const title = `[E2E] ${name} is failing`;
    const id = idByTitle.get(title);

    if (typeof id === `undefined`) {
      create.push({title});
    } else if (failed) {
      resolved.delete(id);
    }
  }

  for (const id of resolved) {
    const number = numberById.get(id);

    await issues.createIssueComment(number, `Solved in ${buildUrl}`);
    await issues.editIssue(number, {state: `closed`});
  }

  for (const {title} of create) {
    await issues.createIssue({title, body: `Started to fail in ${buildUrl}`, labels: [`e2e`]});
  }
});
