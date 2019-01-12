/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
exports.__esModule = true;
var path_1 = require("path");
var vscode = require("vscode");
var VSCodeZipFS = /** @class */ (function () {
    function VSCodeZipFS(zipFs) {
        this._emitter = new vscode.EventEmitter();
        this.onDidChangeFile = this._emitter.event;
        this.zipFs = zipFs;
    }
    VSCodeZipFS.prototype.stat = function (uri) {
        return this.zipFs.statSync(uri.path);
    };
    VSCodeZipFS.prototype.readDirectory = function (uri) {
        var listing = this.zipFs.readdirSync(uri.path);
        var results = [];
        for (var _i = 0, listing_1 = listing; _i < listing_1.length; _i++) {
            var entry = listing_1[_i];
            var entryStat = this.zipFs.statSync(path_1.posix.join(uri.path, entry));
            if (entryStat.isDirectory()) {
                results.push([entry, vscode.FileType.Directory]);
            }
            else {
                results.push([entry, vscode.FileType.File]);
            }
        }
        return results;
    };
    VSCodeZipFS.prototype.readFile = function (uri) {
        return this.zipFs.readFile(uri.path);
    };
    VSCodeZipFS.prototype.writeFile = function (uri, content, options) {
        throw new Error("Not supported");
    };
    VSCodeZipFS.prototype.rename = function (oldUri, newUri, options) {
        throw new Error("Not supported");
    };
    VSCodeZipFS.prototype["delete"] = function (uri) {
        throw new Error("Not supported");
    };
    VSCodeZipFS.prototype.createDirectory = function (uri) {
        throw new Error("Not supported");
    };
    VSCodeZipFS.prototype.watch = function (resource, opts) {
        return new vscode.Disposable(function () { });
    };
    return VSCodeZipFS;
}());
exports.VSCodeZipFS = VSCodeZipFS;
