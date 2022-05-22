import {allSeverities, isError, getReportTree, getRequires, getDependencies} from '@yarnpkg/plugin-npm-cli/sources/npmAuditUtils';

describe(`npmAuditUtils`, () => {
  // Severity levels
  const lowOrHigher = [`low`, `moderate`, `high`, `critical`];
  const moderateOrHigher = [`moderate`, `high`, `critical`];
  const highOrHigher = [`high`, `critical`];
  const criticalOrHigher = [`critical`];

  describe(`allSeverities`, () => {
    test(`it should include info`, () => expect(allSeverities).toContain(`info`));
    test(`it should include low`, () => expect(allSeverities).toContain(`low`));
    test(`it should include moderate`, () => expect(allSeverities).toContain(`moderate`));
    test(`it should include high`, () => expect(allSeverities).toContain(`high`));
    test(`it should include critical`, () => expect(allSeverities).toContain(`critical`));
  });

  describe(`isError`, () => {
    // vulnerability objects
    const none = {info: 0, low: 0, moderate: 0, high: 0, critical: 0};
    const info = {info: 1, low: 0, moderate: 0, high: 0, critical: 0};
    const low = {info: 0, low: 1, moderate: 0, high: 0, critical: 0};
    const moderate = {info: 0, low: 0, moderate: 1, high: 0, critical: 0};
    const high = {info: 0, low: 0, moderate: 0, high: 1, critical: 0};
    const critical = {info: 0, low: 0, moderate: 0, high: 0, critical: 1};

    test(`it should return false with no vulnerabilities`, () => {
      expect(isError(none)).toBeFalsy();
      for (const severity of allSeverities) {
        expect(isError(none, severity)).toBeFalsy();
      }
    });

    test(`it should return true with any vulnerabilities`, () => {
      expect(isError(info)).toBeTruthy();
      expect(isError(low)).toBeTruthy();
      expect(isError(moderate)).toBeTruthy();
      expect(isError(high)).toBeTruthy();
      expect(isError(critical)).toBeTruthy();
    });

    test(`it should return true with vulnerabilities at or above requested severity`, () => {
      for (const severity of allSeverities.filter(severity => !lowOrHigher.includes(severity)))
        expect(isError(low, severity)).toBeTruthy();

      for (const severity of allSeverities.filter(severity => !moderateOrHigher.includes(severity)))
        expect(isError(moderate, severity)).toBeTruthy();

      for (const severity of allSeverities.filter(severity => !highOrHigher.includes(severity)))
        expect(isError(high, severity)).toBeTruthy();

      for (const severity of allSeverities.filter(severity => !criticalOrHigher.includes(severity))) {
        expect(isError(critical, severity)).toBeTruthy();
      }
    });

    test(`it should return false with vulnerabilities below requested severity`, () => {
      for (const severity of lowOrHigher)
        expect(isError(info, severity)).toBeFalsy();

      for (const severity of moderateOrHigher)
        expect(isError(low, severity)).toBeFalsy();

      for (const severity of highOrHigher)
        expect(isError(moderate, severity)).toBeFalsy();

      expect(isError(high, `critical`)).toBeFalsy();
    });
  });

  describe(`getReportTree`, () => {
    const id = 1337;
    const title = `title`;
    const url = `url`;
    const vulnerable_versions = `vulnerable_versions`;
    const patched_versions = `patched_versions`;
    const recommendation = `recommendation`;
    const version = `version`;
    const path = `path`;
    // vulnerability objects
    const advisory = {id, title, url, vulnerable_versions, patched_versions, recommendation, findings: [{version, paths: [path]}]};
    const info = {...advisory, module_name: `info_module`, severity: `info`};
    const low = {...advisory, module_name: `low_module`, severity: `low`};
    const moderate = {...advisory, module_name: `moderate_module`, severity: `moderate`};
    const high = {...advisory, module_name: `high_module`, severity: `high`};
    const critical = {...advisory, module_name: `critical_module`, severity: `critical`};
    // expected values
    const boilerplate = {children: {}};

    test(`it should return a tree with just boilerplate with no vulnerabilities`, () => {
      expect(getReportTree({advisories: {}})).toStrictEqual(boilerplate);
      for (const severity of allSeverities) {
        expect(getReportTree({advisories: {}}, severity)).toStrictEqual(boilerplate);
      }
    });

    test(`it should return a tree with just boilerplate with only vulnerabilities below the requested minimum severity`, () => {
      for (const severity of lowOrHigher)
        expect(getReportTree({advisories: {idno: info}}, severity)).toStrictEqual(boilerplate);

      for (const severity of moderateOrHigher) {
        expect(getReportTree({advisories: {idno: low}}, severity)).toStrictEqual(boilerplate);
        expect(getReportTree({advisories: {idno: info, idno2: low}}, severity)).toStrictEqual(boilerplate);
      }
      for (const severity of highOrHigher) {
        expect(getReportTree({advisories: {idno: moderate}}, severity)).toStrictEqual(boilerplate);
        expect(getReportTree({advisories: {idno: low, idno2: moderate}}, severity)).toStrictEqual(boilerplate);
        expect(getReportTree({advisories: {idno: info, idno2: low, idno3: moderate}}, severity)).toStrictEqual(boilerplate);
      }
      expect(getReportTree({advisories: {idno: high}}, `critical`)).toStrictEqual(boilerplate);
      expect(getReportTree({advisories: {idno: moderate, idno2: high}}, `critical`)).toStrictEqual(boilerplate);
      expect(getReportTree({advisories: {idno: low, idno2: moderate, idno3: high}}, `critical`)).toStrictEqual(boilerplate);
      expect(getReportTree({advisories: {idno: info, idno2: low, idno3: moderate, idno4: high}}, `critical`)).toStrictEqual(boilerplate);
    });

    test(`it should return a tree if there are vulnerabilities`, () => {
      expect(getReportTree({advisories: {idno: info}})).not.toStrictEqual(boilerplate);
      expect(getReportTree({advisories: {idno: low}})).not.toStrictEqual(boilerplate);
      for (const severity of allSeverities.filter(severity => !lowOrHigher.includes(severity)))
        expect(getReportTree({advisories: {idno: low}}, severity)).not.toStrictEqual(boilerplate);

      expect(getReportTree({advisories: {idno: moderate}})).not.toStrictEqual(boilerplate);
      for (const severity of allSeverities.filter(severity => !moderateOrHigher.includes(severity)))
        expect(getReportTree({advisories: {idno: moderate}}, severity)).not.toStrictEqual(boilerplate);

      expect(getReportTree({advisories: {idno: high}})).not.toStrictEqual(boilerplate);
      for (const severity of allSeverities.filter(severity => !highOrHigher.includes(severity)))
        expect(getReportTree({advisories: {idno: high}}, severity)).not.toStrictEqual(boilerplate);

      expect(getReportTree({advisories: {idno: critical}})).not.toStrictEqual(boilerplate);
      for (const severity of allSeverities.filter(severity => !criticalOrHigher.includes(severity))) {
        expect(getReportTree({advisories: {idno: critical}}, severity)).not.toStrictEqual(boilerplate);
      }
    });

    test(`it should return a tree only with the vulnerabilities above severity level`, () => {
      expect(getReportTree({advisories: {idno: low, ignore: info}}, `low`)).not.toMatchObject({children: {info_module: {}}});
      expect(getReportTree({advisories: {idno: moderate, ignore: info}}, `low`)).not.toMatchObject({children: {info_module: {}}});
      expect(getReportTree({advisories: {idno: high, ignore: info}}, `low`)).not.toMatchObject({children: {info_module: {}}});
      expect(getReportTree({advisories: {idno: critical, ignore: info}}, `low`)).not.toMatchObject({children: {info_module: {}}});

      expect(getReportTree({advisories: {idno: moderate, ignore: low}}, `moderate`)).not.toMatchObject({children: {low_module: {}}});
      expect(getReportTree({advisories: {idno: high, ignore: low}}, `moderate`)).not.toMatchObject({children: {low_module: {}}});
      expect(getReportTree({advisories: {idno: critical, ignore: low}}, `moderate`)).not.toMatchObject({children: {low_module: {}}});

      expect(getReportTree({advisories: {idno: high, ignore: moderate}}, `high`)).not.toMatchObject({children: {moderate_module: {}}});
      expect(getReportTree({advisories: {idno: critical, ignore: moderate}}, `high`)).not.toMatchObject({children: {moderate_module: {}}});

      expect(getReportTree({advisories: {idno: critical, ignore: high}}, `critical`)).not.toMatchObject({children: {high_module: {}}});
    });

    test(`it should return a tree with multiple vulnerabilities if above the severity level`, () => {
      expect(getReportTree({advisories: {idno: critical, ignore: high}}, `high`)).toMatchObject({children: {critical_module: {}, high_module: {}}});
    });

    test(`it should return all expected fields in the tree`, () => {
      // TODO this would be better suited to mocking out formatUtils and checking whether it is called with the appropriate values
      const expected = {
        children: {
          info_module: {
            label: `info_module`,
            value: [version, `RANGE`],
            children: {
              ID: {label: `ID`, value: [id, `NUMBER`]},
              Issue: {label: `Issue`, value: [title, `NO_HINT`]},
              "Patched Versions": {label: `Patched Versions`, value: [patched_versions, `RANGE`]},
              Recommendation: {label: `Recommendation`, value: [recommendation, `NO_HINT`]},
              Severity: {label: `Severity`, value: [`info`, `NO_HINT`]},
              URL: {label: `URL`, value: [url, `URL`]},
              Via: {label: `Via`, value: [path, `NO_HINT`]},
              "Vulnerable Versions": {label: `Vulnerable Versions`, value: [vulnerable_versions, `RANGE`]},
            },
          },
        },
      };
      expect(getReportTree({advisories: {idno: info}})).toMatchObject(expected);
    });
  });

  describe(`getRequires`, () => {
    // TODO
    // args: project, workspace, all, environment
    // `all` selects either project.workspaces or the workspace arg
    // `environment` call be all, dev, or production. this should limit the results
    getRequires;
  });

  describe(`getDependencies`, () => {
    // TODO
    // args: project, workspace, all
    // `all` selects either project.workspaces or the workspace arg
    // calls getTransitiveDevDependencies to do the heavy lifting
    getDependencies;
  });
});
