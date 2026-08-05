import {npath} from '@yarnpkg/fslib';

export const ZIP_FILE_EXTENSIONS = [
  `.zip`,
  `.jar`,
  `.war`,
  `.apk`,
  `.ipa`,
  `.crx`,
  `.3mf`,
];

export function isZipFile(path: string): boolean {
  return ZIP_FILE_EXTENSIONS.includes(npath.extname(path));
}
