import {PortablePath}  from '@yarnpkg/fslib';
import {PassThrough}   from 'stream';

import {Configuration} from '../sources/Configuration';
import {MessageName}   from '../sources/MessageName';
import {StreamReport}  from '../sources/StreamReport';

const configuration = Configuration.create(PortablePath.root);

describe(`StreamReport`, () => {
  it.each<[string, {failOnWarnings?: boolean, reports: Array<`error` | `warning`>}, {exitCode: number, hasWarnings: boolean}]>([
    [`no errors or warnings`,              {reports: []},                                          {exitCode: 0, hasWarnings: false}],
    [`errors only`,                        {reports: [`error`]},                                   {exitCode: 1, hasWarnings: false}],
    [`warnings, failOnWarnings=false`,     {failOnWarnings: false, reports: [`warning`]},          {exitCode: 0, hasWarnings: true}],
    [`warnings, failOnWarnings=true`,      {failOnWarnings: true, reports: [`warning`]},           {exitCode: 1, hasWarnings: true}],
    [`errors, failOnWarnings=false`,       {failOnWarnings: false, reports: [`error`]},            {exitCode: 1, hasWarnings: false}],
    [`errors and warnings`,                {reports: [`error`, `warning`]},                        {exitCode: 1, hasWarnings: true}],
  ])(`%s`, async (_label, {failOnWarnings, reports}, expected) => {
    const stdout = new PassThrough();

    const report = await StreamReport.start({configuration, stdout, failOnWarnings}, async report => {
      for (const type of reports) {
        if (type === `error`) {
          report.reportError(MessageName.UNNAMED, `test error`);
        } else {
          report.reportWarning(MessageName.UNNAMED, `test warning`);
        }
      }
    });

    expect(report.exitCode()).toEqual(expected.exitCode);
    expect(report.hasWarnings()).toEqual(expected.hasWarnings);
  });
});
