/**
 * Simple helper function that assign an error code to an error, so that it can more easily be caught and used
 * by third-parties.
 */

export function makeError(code: string, message: string, data: Object = {}): Error {
  const error = new Error(message);
  return Object.assign(error, {code, data});
}

/**
 * Returns the module that should be used to resolve require calls. It's usually the direct parent, except if we're
 * inside an eval expression.
 */

export function getIssuerModule(parent: NodeModule | null): NodeModule | null {
  let issuer = parent;

  while (issuer && (issuer.id === '[eval]' || issuer.id === '<repl>' || !issuer.filename))
    issuer = issuer.parent;

  return issuer;
}
