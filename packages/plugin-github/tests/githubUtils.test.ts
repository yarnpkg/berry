import {isGithubUrl, parseGithubUrl, invalidGithubUrlMessage} from '../sources/githubUtils';

const validScenarios = [{
  url: 'git://github.com/owner/repo.git#ff786f9f',
  username: 'owner', reponame: 'repo', branch: 'ff786f9f',
}, {
  url: 'git://github.com/owner/repo.git#foo_bar',
  username: 'owner', reponame: 'repo', branch: 'foo_bar',
}, {
  url: 'git://github.com/owner/repo.git#master',
  username: 'owner', reponame: 'repo', branch: 'master',
}, {
  url: 'git://github.com/owner/repo.git#Foo-Bar',
  username: 'owner', reponame: 'repo', branch: 'Foo-Bar',
}, {
  url: 'git://github.com/owner/repo.git#foo_bar',
  username: 'owner', reponame: 'repo', branch: 'foo_bar',
}, {
  url: 'git://github.com/owner/repo.git#v2.0.0',
  username: 'owner', reponame: 'repo', branch: 'v2.0.0',
}, {
  url: 'git+ssh://git@github.com:owner/repo.git#123456',
  username: 'owner', reponame: 'repo', branch: '123456',
}, {
  url: 'git@github.com:owner/repo.git',
  username: 'owner', reponame: 'repo', branch: undefined,
}, {
  url: 'git@github.com:owner/other-repo.git',
  username: 'owner', reponame: 'other-repo', branch: undefined,
}, {
  url: 'git@github.com:owner/other-repo.git',
  username: 'owner', reponame: 'other-repo', branch: undefined,
}, {
  url: 'http://github.com/owner/repo.git',
  username: 'owner', reponame: 'repo', branch: undefined,
}, {
  url: 'https://github.com/owner/repo.git',
  username: 'owner', reponame: 'repo', branch: undefined,
}, {
  url: 'https://yarnpkg::;*%$:@github.com/owner/repo.git',
  username: 'owner', reponame: 'repo', branch: undefined,
}, {
  url: 'https://yarnpkg:$fooABC@:@github.com/owner/repo.git',
  username: 'owner', reponame: 'repo', branch: undefined,
}, {
  url: 'https://yarnpkg:password@github.com/owner/repo.git',
  username: 'owner', reponame: 'repo', branch: undefined,
}];

const invalidScenarios = [{
  url: 'shttp://github.com/owner/repo.git#master',
}, {
  url: 'got://github.com/owner/repo#ff786f9f',
}, {
  url: 'git://github.com/owner/repo',
}, {
  url: 'http://github.com/owner',
}];

describe(`githubUtils`, () => {
  describe('isGithubUrl', () => {
    it('should handle undefined', () => {
      expect(isGithubUrl(undefined)).not.toBeTruthy();
    })

    for (const scenario of validScenarios) {
      it(`should properly detect GitHub urls (${scenario.url})`, () => {
        expect(isGithubUrl(scenario.url)).toBeTruthy();
      });
    }

    for (const scenario of invalidScenarios) {
      it(`should properly reject invalid GitHub urls (${scenario.url})`, () => {
        expect(isGithubUrl(scenario.url)).not.toBeTruthy();
      });
    }
  })

  describe('parseGithubUrl', () => {
    for (const scenario of validScenarios) {
      it(`should properly parse GitHub urls (${scenario.url})`, () => {
        let parsed = parseGithubUrl(scenario.url);

        expect(parsed).toMatchObject({
          username: scenario.username,
          reponame: scenario.reponame,
          branch: scenario.branch,
        });
      });
    }

    it(`should throw an error when given an invalid URL`, () => {
      const invalidUrl = 'http://invalid.com/owner/repo.git';
      const expected = invalidGithubUrlMessage(invalidUrl);

      expect(() => {
        parseGithubUrl(invalidUrl);
      }).toThrow(expected);
    });
  });
})
