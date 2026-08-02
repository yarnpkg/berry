import extensionManifest                from '../package.json';
import {isZipFile, ZIP_FILE_EXTENSIONS} from '../sources/zipFileExtensions';

describe(`ZipFS archive extensions`, () => {
  it(`keeps the VS Code language registration in sync with the filesystem`, () => {
    expect(extensionManifest.contributes.languages[0].extensions).toEqual(ZIP_FILE_EXTENSIONS);
  });

  it.each([
    [`archive.zip`, true],
    [`application.jar`, true],
    [`service.war`, true],
    [`app.apk`, true],
    [`application.ipa`, true],
    [`extension.crx`, true],
    [`archive.tar.gz`, false],
  ])(`recognizes %s as %s`, (path, expected) => {
    expect(isZipFile(path)).toBe(expected);
  });
});
