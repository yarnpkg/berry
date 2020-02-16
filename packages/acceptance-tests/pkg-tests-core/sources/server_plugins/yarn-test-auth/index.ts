/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable arca/no-default-export */

import {getForbidden, getUnauthorized, getInternalError}                         from '@verdaccio/commons-api';
import {PluginOptions, Callback, PackageAccess, IPluginAuth, RemoteUser, Logger} from '@verdaccio/types';

import {YarnAuthMemoryConfig}                                                    from '../types';

export default class Memory implements IPluginAuth<YarnAuthMemoryConfig> {
  public _logger: Logger;
  public _allowed: string[];
  public _config: {};
  public _app_config: YarnAuthMemoryConfig;

  public constructor(config: YarnAuthMemoryConfig, appOptions: PluginOptions<YarnAuthMemoryConfig>) {
    this._allowed = config.allowed || [];
    this._config = config;
    this._logger = appOptions.logger;
  }

  public authenticate(user: string, password: string, done: Callback): void {
    if (!this._allowed.includes(user)) {
      const err = getUnauthorized("user is not allowed");
      this._logger.info({user}, '[YarnAuthMemory] password invalid for: @{user}');

      return done(err);
    }

    this._logger.info({user}, '[YarnAuthMemory] authentication succeeded for @{user}');
    return done(null, [user]);
  }

  public adduser(user: string, password: string, done: Callback): void {
    if (user === 'fail')
      return done(getUnauthorized('yarn auth plugin not allowed action'));


    done(null, true);
  }

  public changePassword(username: string, password: string, newPassword: string, cb: Callback): void {
    return cb(getInternalError('not implemented'));
  }

  public allow_access(user: RemoteUser, pkg: PackageAccess, cb: Callback): void {
    if ((this._allowed.includes(user.name))) {
      this._logger.debug({user: user.name}, '[YarnAuthMemory] user: @{user} has been granted access');

      return cb(null, true);
    }

    const err = getForbidden('not allowed to access package');

    this._logger.debug({user: user.name}, '[YarnAuthMemory] user: @{user} not allowed to access package');
    return cb(err);
  }

  /** eslint-disable @typescript-eslint/camelcase **/
  public allow_publish(user: RemoteUser, pkg: PackageAccess, cb: Callback): void {
    if ((this._allowed.includes(user.name))) {
      this._logger.debug({user: user.name}, '[YarnAuthMemory] user: @{user} has been granted to publish');
      return cb(null, true);
    }

    const err = getForbidden('not allowed to publish package');
    this._logger.debug({user: user.name}, '[YarnAuthMemory] user: @{user} not allowed to publish package');

    return cb(err);
  }
}
