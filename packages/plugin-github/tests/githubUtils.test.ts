import { isGithubUrl, parseGithubUrl, invalidGithubUrlMessage } from '../sources/githubUtils';

const validScenarios = [{
  url: 'git://github.com/yarnpkg/berry.git#ff786f9f',
  username: 'yarnpkg', reponame: 'berry', branch: 'ff786f9f',
}, {
  url: 'git://github.com/yarnpkg/berry.git#foo_bar',
  username: 'yarnpkg', reponame: 'berry', branch: 'foo_bar',
}, {
  url: 'git://github.com/yarnpkg/berry.git#master',
  username: 'yarnpkg', reponame: 'berry', branch: 'master',
}, {
  url: 'git://github.com/yarnpkg/berry.git#Foo-Bar',
  username: 'yarnpkg', reponame: 'berry', branch: 'Foo-Bar',
}, {
  url: 'git://github.com/yarnpkg/berry.git#foo_bar',
  username: 'yarnpkg', reponame: 'berry', branch: 'foo_bar',
}, {
  url: 'git://github.com/yarnpkg/berry.git#v2.0.0',
  username: 'yarnpkg', reponame: 'berry', branch: 'v2.0.0',
}, {
  url: 'git+ssh://git@github.com:yarnpkg/berry.git#123456',
  username: 'yarnpkg', reponame: 'berry', branch: '123456',
}, {
  url: 'git@github.com:yarnpkg/berry.git',
  username: 'yarnpkg', reponame: 'berry', branch: undefined,
}, {
  url: 'git@github.com:yarnpkg/berry-project.git',
  username: 'yarnpkg', reponame: 'berry-project', branch: undefined,
}, {
  url: 'git@github.com:yarnpkg/berry_project.git',
  username: 'yarnpkg', reponame: 'berry_project', branch: undefined,
}, {
  url: 'http://github.com/yarnpkg/berry.git',
  username: 'yarnpkg', reponame: 'berry', branch: undefined,
}, {
  url: 'https://github.com/yarnpkg/berry.git',
  username: 'yarnpkg', reponame: 'berry', branch: undefined,
}, {
  url: 'https://yarnpkg::;*%$:@github.com/yarnpkg/berry.git',
  username: 'yarnpkg', reponame: 'berry', branch: undefined,
}, {
  url: 'https://yarnpkg:$fooABC@:@github.com/yarnpkg/berry.git',
  username: 'yarnpkg', reponame: 'berry', branch: undefined,
}, {
  url: 'https://yarnpkg:password@github.com/yarnpkg/berry.git',
  username: 'yarnpkg', reponame: 'berry', branch: undefined,
}];

const invalidScenarios = [{
  url: 'shttp://github.com/yarnpkg/berry.git#master',
}, {
  url: 'got://github.com/yarnpkg/berry#ff786f9f',
}, {
  url: 'git://github.com/yarnpkg/berry',
}, {
  url: 'http://github.com/yarnpkg',
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
      const invalidUrl = 'http://invalid.com/yarnpkg/berry.git';
      const expected = invalidGithubUrlMessage(invalidUrl);

      expect(() => {
        parseGithubUrl(invalidUrl);
      }).toThrow(expected);
    });
  });
})
