

import { isGithubUrl, parseGithubUrl, invalidGithubUrlMessage } from "../sources/githubUtils";

const validScenarios = [
  { username: 'yarnpkg', repo: 'berry', branch: 'ff786f9f',   url: 'git://github.com/yarnpkg/berry.git#ff786f9f', },
  { username: 'yarnpkg', repo: 'berry', branch: 'foo_bar',    url: 'git://github.com/yarnpkg/berry.git#foo_bar', },
  { username: 'yarnpkg', repo: 'berry', branch: 'master',     url: 'git://github.com/yarnpkg/berry.git#master', },
  { username: 'yarnpkg', repo: 'berry', branch: 'Foo-Bar',    url: 'git://github.com/yarnpkg/berry.git#Foo-Bar', },
  { username: 'yarnpkg', repo: 'berry', branch: 'foo_bar',    url: 'git://github.com/yarnpkg/berry.git#foo_bar', },
  { username: 'yarnpkg', repo: 'berry', branch: 'v2.0.0',     url: 'git://github.com/yarnpkg/berry.git#v2.0.0', },
  { username: 'yarnpkg', repo: 'berry', branch: undefined,           url: 'git@github.com:yarnpkg/berry.git', },
  { username: 'yarnpkg', repo: 'berry-project', branch: undefined,   url: 'git@github.com:yarnpkg/berry-project.git', },
  { username: 'yarnpkg', repo: 'berry_project', branch: undefined,   url: 'git@github.com:yarnpkg/berry_project.git', },
  { username: 'yarnpkg', repo: 'berry', branch: undefined,           url: 'http://github.com/yarnpkg/berry.git', },
  { username: 'yarnpkg', repo: 'berry', branch: undefined,           url: 'https://github.com/yarnpkg/berry.git', },
  { username: 'yarnpkg', repo: 'berry', branch: undefined,           url: 'https://yarnpkg::;*%$:@github.com/yarnpkg/berry.git', },
  { username: 'yarnpkg', repo: 'berry', branch: undefined,           url: 'https://yarnpkg:$fooABC@:@github.com/yarnpkg/berry.git', },
  { username: 'yarnpkg', repo: 'berry', branch: undefined,           url: 'https://yarnpkg:password@github.com/yarnpkg/berry.git' }
];

describe(`githubUtils`, () => {

  describe('isGithubUrl', () => {

    it('should handle undefined', () => {
      expect(isGithubUrl(undefined)).not.toBeTruthy();
    })

    it(`should respond truthy to valid urls`, () => {

      for (const scenario of validScenarios)
        expect(isGithubUrl(scenario.url)).toBeTruthy();
    });

    it(`should respond false to invalid urls`, () => {

      const invalidUrls = [
        'got://github.com/yarnpkg/berry#ff786f9f',
        'git://github.com/yarnpkg/berry',
        'http://github.com/yarnpkg',
      ];

      for (const url of invalidUrls)
        expect(isGithubUrl(url)).not.toBeTruthy();
    });
  })

  describe('parseGithubUrl', () => {

    it(`should correctly parse valid github urls`, () => {
      for (const scenario of validScenarios) {
        let parsed = parseGithubUrl(scenario.url);
        expect(parsed.username).toEqual(scenario.username);
        expect(parsed.reponame).toEqual(scenario.repo);
        expect(parsed.branch).toEqual(scenario.branch);
      }
    });

    it(`should throw an error given an invalid URL`, () => {
      const invalidUrl = 'http://invalid.com/yarnpkg/berry.git';
      let error = undefined;
      const expected = invalidGithubUrlMessage(invalidUrl);

      try {
        const url = parseGithubUrl(invalidUrl);
      } catch(e) {
        error = e.message;
      }

      expect(error).toEqual(expected);
    });
  });
})
