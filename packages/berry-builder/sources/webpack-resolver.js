let pnp;

try {
  pnp = require(`pnpapi`);
} catch (error) {
  // not a problem
}

module.exports = {
  apply: function(resolver) {
    if (!pnp)
      return;

    const MAYBE_MIXIN = /^[^\/]+$/;

    resolver.getHook(`file`).intercept({
      register: tapInfo => {
        return tapInfo.name !== `SymlinkPlugin` ? tapInfo : {... tapInfo, fn: (request, resolveContext, callback) => {
          callback();
        }};
      }
    });

    const resolvedHook = resolver.ensureHook(`resolve`);
    
    resolver.getHook(`before-module`).tapAsync(`PnpResolver`, (request, resolveContext, callback) => {
      let req = request.request;

      let issuer;
      let resolution;

      // Webpack doesn't care about builtins, so we add a trailing '/' if it might be one to force the resolution to disregard the builtin check
      if (MAYBE_MIXIN.test(req))
        req += `/`;

      // When using require.context, issuer seems to be false (cf https://github.com/webpack/webpack-dev-server/blob/d0725c98fb752d8c0b1e8c9067e526e22b5f5134/client-src/default/index.js#L94)
      if (!request.context.issuer)
        issuer = `${request.path}/`;

      // Otherwise, if the issuer provided by Webpack is a valid absolute path, then we can use it as our issuer
      else if (request.context.issuer.startsWith(`/`))
        issuer = request.context.issuer;

      // Shouldn't happen, but just in case
      else
        throw new Error(`Cannot successfully resolve this dependency`);

      try {
        resolution = pnp.resolveToUnqualified(req, issuer);
      } catch (error) {
        return callback(error);
      }

      resolver.doResolve(
        resolvedHook,
        Object.assign({}, request, {request: resolution}),
        null,
        resolveContext,
        callback,
      );
    });
  },
};
