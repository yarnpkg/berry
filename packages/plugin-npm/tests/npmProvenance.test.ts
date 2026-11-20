import {createServer, IncomingMessage, Server, ServerResponse} from 'http';
import {AddressInfo}                                           from 'net';

import {makeTransparencyLogWitness}                            from '../sources/npmProvenance';

const ENTRY_UUID = `108e9186e8c5677a4d43271c05b255f9295837f60217bc41784d59c8f03c3e9e1178c3ec65c4fce8`;

const ENTRY = {
  body: Buffer.from(JSON.stringify({kind: `dsse`, apiVersion: `0.0.1`, spec: {}})).toString(`base64`),
  integratedTime: 1700000000,
  logID: `c0d23d6ad406973f9559f3ba2d1ca01f84147d8ffc5b8445c224f98b9591801d`,
  logIndex: 42,
  verification: {
    signedEntryTimestamp: Buffer.from(`signed-entry-timestamp`).toString(`base64`),
  },
};

const startTransparencyLog = async (handler: (request: IncomingMessage, response: ServerResponse) => void) => {
  const server = createServer((request, response) => {
    // The body must be consumed for the response to be sent
    request.resume();
    request.on(`end`, () => handler(request, response));
  });

  await new Promise<void>(resolve => {
    server.listen(0, `127.0.0.1`, resolve);
  });

  return server;
};

const stopTransparencyLog = async (server: Server) => {
  await new Promise(resolve => {
    server.close(resolve);
  });
};

describe(`npmProvenance`, () => {
  describe(`makeTransparencyLogWitness`, () => {
    it(`should reuse the existing entry when a retried request conflicts with the one the log already recorded`, async () => {
      const requests: Array<string> = [];

      const server = await startTransparencyLog((request, response) => {
        requests.push(`${request.method} ${request.url}`);

        const postCount = requests.filter(entry => entry.startsWith(`POST`)).length;

        if (request.method === `POST` && postCount === 1) {
          // The log recorded the entry, but the client never gets to know
          response.writeHead(502);
          response.end();
        } else if (request.method === `POST`) {
          response.writeHead(409, {location: `/api/v1/log/entries/${ENTRY_UUID}`});
          response.end(JSON.stringify({code: 409, message: `an equivalent entry already exists in the transparency log with UUID ${ENTRY_UUID}`}));
        } else {
          response.writeHead(200, {[`content-type`]: `application/json`});
          response.end(JSON.stringify({[ENTRY_UUID]: ENTRY}));
        }
      });

      try {
        const {port} = server.address() as AddressInfo;

        const witness = makeTransparencyLogWitness({
          rekorBaseURL: `http://127.0.0.1:${port}`,
        });

        const {tlogEntries} = await witness.testify({
          $case: `dsseEnvelope`,
          dsseEnvelope: {
            payload: Buffer.from(`{}`),
            payloadType: `application/vnd.in-toto+json`,
            signatures: [{sig: Buffer.from(`signature`), keyid: ``}],
          },
        }, `public-key`);

        expect(requests).toEqual([
          `POST /api/v1/log/entries`,
          `POST /api/v1/log/entries`,
          `GET /api/v1/log/entries/${ENTRY_UUID}`,
        ]);

        expect(tlogEntries).toHaveLength(1);
        expect(tlogEntries[0].logIndex).toEqual(`42`);
      } finally {
        await stopTransparencyLog(server);
      }
    }, 30000);
  });
});
