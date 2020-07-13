function makeError(code: string, message: string) {
  return Object.assign(new Error(`${code}: ${message}`), {code});
}

// FS
// ------------------------------------------------------------------------

export function EBUSY(message: string) {
  return makeError(`EBUSY`, message);
}

export function ENOSYS(message: string, reason: string) {
  return makeError(`ENOSYS`, `${message}, ${reason}`);
}

export function EINVAL(reason: string) {
  return makeError(`EINVAL`, `invalid argument, ${reason}`);
}

export function EBADF(reason: string) {
  return makeError(`EBADF`, `bad file descriptor, ${reason}`);
}

export function ENOENT(reason: string) {
  return makeError(`ENOENT`, `no such file or directory, ${reason}`);
}

export function ENOTDIR(reason: string) {
  return makeError(`ENOTDIR`, `not a directory, ${reason}`);
}

export function EISDIR(reason: string) {
  return makeError(`EISDIR`, `illegal operation on a directory, ${reason}`);
}

export function EEXIST(reason: string) {
  return makeError(`EEXIST`, `file already exists, ${reason}`);
}

export function EROFS(reason: string) {
  return makeError(`EROFS`, `read-only filesystem, ${reason}`);
}

// URL
// ------------------------------------------------------------------------

export function ERR_INVALID_URL_SCHEME(expected: string) {
  return makeError(`ERR_INVALID_URL_SCHEME`, `The URL must be ${expected}`);
}

export function ERR_INVALID_FILE_URL_HOST(platform: NodeJS.Platform) {
  return makeError(`ERR_INVALID_FILE_URL_HOST`, `File URL host must be "localhost" or empty on ${platform}`);
}

export function ERR_INVALID_FILE_URL_PATH(reason: string) {
  return makeError(`ERR_INVALID_FILE_URL_PATH`, `File URL path ${reason}`);
}
