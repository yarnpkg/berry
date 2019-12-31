export const patch = `
diff --git a/lib/tsc.js b/lib/tsc.js
index d7f749f..3b98f16 100644
--- a/lib/tsc.js
+++ b/lib/tsc.js
@@ -22576,21 +22576,47 @@ var ts;
         }
     }
     ts.getEffectiveTypeRoots = getEffectiveTypeRoots;
-    function getDefaultTypeRoots(currentDirectory, host) {
+    function getNodeModulesTypeRoots(currentDirectory, host) {
         if (!host.directoryExists) {
             return [ts.combinePaths(currentDirectory, nodeModulesAtTypes)];
         }
-        var typeRoots;
+        var typeRoots = [];
         ts.forEachAncestorDirectory(ts.normalizePath(currentDirectory), function (directory) {
             var atTypes = ts.combinePaths(directory, nodeModulesAtTypes);
             if (host.directoryExists(atTypes)) {
-                (typeRoots || (typeRoots = [])).push(atTypes);
+                typeRoots.push(atTypes);
             }
             return undefined;
         });
         return typeRoots;
     }
     var nodeModulesAtTypes = ts.combinePaths("node_modules", "@types");
+    function getPnpTypeRoots(currentDirectory) {
+        if (!isPnpAvailable()) {
+            return [];
+        }
+        var pnpapi = getPnpApi();
+        var locator = pnpapi.findPackageLocator(currentDirectory + "/");
+        var packageDependencies = pnpapi.getPackageInformation(locator).packageDependencies;
+        var typeRoots = [];
+        for (var _i = 0, _a = Array.from(packageDependencies.entries()); _i < _a.length; _i++) {
+            var _b = _a[_i], name = _b[0], referencish = _b[1];
+            if (name.startsWith(typesPackagePrefix) && referencish !== null) {
+                var dependencyLocator = pnpapi.getLocator(name, referencish);
+                var packageLocation = pnpapi.getPackageInformation(dependencyLocator).packageLocation;
+                typeRoots.push(ts.getDirectoryPath(packageLocation));
+            }
+        }
+        return typeRoots;
+    }
+    var typesPackagePrefix = "@types/";
+    function getDefaultTypeRoots(currentDirectory, host) {
+        var nmTypes = getNodeModulesTypeRoots(currentDirectory, host);
+        var pnpTypes = getPnpTypeRoots(currentDirectory);
+        if (nmTypes.length > 0 || pnpTypes.length > 0) {
+            return [].concat(nmTypes, pnpTypes);
+        }
+    }
     function resolveTypeReferenceDirective(typeReferenceDirectiveName, containingFile, options, host, redirectedReference) {
         var traceEnabled = isTraceEnabled(options, host);
         if (redirectedReference) {
@@ -22670,7 +22696,9 @@ var ts;
                 }
                 var result = void 0;
                 if (!ts.isExternalModuleNameRelative(typeReferenceDirectiveName)) {
-                    var searchResult = loadModuleFromNearestNodeModulesDirectory(Extensions.DtsOnly, typeReferenceDirectiveName, initialLocationForSecondaryLookup, moduleResolutionState, undefined, undefined);
+                    var searchResult = isPnpAvailable()
+                        ? tryLoadModuleUsingPnpResolution(Extensions.DtsOnly, typeReferenceDirectiveName, initialLocationForSecondaryLookup, moduleResolutionState)
+                        : loadModuleFromNearestNodeModulesDirectory(Extensions.DtsOnly, typeReferenceDirectiveName, initialLocationForSecondaryLookup, moduleResolutionState, undefined, undefined);
                     result = searchResult && searchResult.value;
                 }
                 else {
@@ -23043,9 +23071,12 @@ var ts;
                 if (traceEnabled) {
                     trace(host, ts.Diagnostics.Loading_module_0_from_node_modules_folder_target_file_type_1, moduleName, Extensions[extensions]);
                 }
-                var resolved_1 = loadModuleFromNearestNodeModulesDirectory(extensions, moduleName, containingDirectory, state, cache, redirectedReference);
-                if (!resolved_1)
+                var resolved_1 = isPnpAvailable()
+                    ? tryLoadModuleUsingPnpResolution(extensions, moduleName, containingDirectory, state)
+                    : loadModuleFromNearestNodeModulesDirectory(extensions, moduleName, containingDirectory, state, cache, redirectedReference);
+                if (!resolved_1) {
                     return undefined;
+                }
                 var resolvedValue = resolved_1.value;
                 if (!compilerOptions.preserveSymlinks && resolvedValue && !resolvedValue.originalPath) {
                     var path = realPath(resolvedValue.path, host, traceEnabled);
@@ -23487,6 +23518,45 @@ var ts;
     function toSearchResult(value) {
         return value !== undefined ? { value: value } : undefined;
     }
+    function isPnpAvailable() {
+        return process.versions.pnp;
+    }
+    function getPnpApi() {
+        return require("pnpapi");
+    }
+    function loadPnpPackageResolution(packageName, containingDirectory) {
+        try {
+            return getPnpApi().resolveToUnqualified(packageName, containingDirectory + "/", { considerBuiltins: false });
+        }
+        catch (_a) {
+        }
+    }
+    function loadPnpTypePackageResolution(packageName, containingDirectory) {
+        return loadPnpPackageResolution(getTypesPackageName(packageName), containingDirectory);
+    }
+    function tryLoadModuleUsingPnpResolution(extensions, moduleName, containingDirectory, state) {
+        var _a = parsePackageName(moduleName), packageName = _a.packageName, rest = _a.rest;
+        var packageResolution = loadPnpPackageResolution(packageName, containingDirectory);
+        var packageFullResolution = packageResolution
+            ? nodeLoadModuleByRelativeName(extensions, ts.combinePaths(packageResolution, rest), false, state, true)
+            : undefined;
+        var resolved;
+        if (packageFullResolution) {
+            resolved = packageFullResolution;
+        }
+        else if (extensions === Extensions.TypeScript || extensions === Extensions.DtsOnly) {
+            var typePackageResolution = loadPnpTypePackageResolution(packageName, containingDirectory);
+            var typePackageFullResolution = typePackageResolution
+                ? nodeLoadModuleByRelativeName(Extensions.DtsOnly, ts.combinePaths(typePackageResolution, rest), false, state, true)
+                : undefined;
+            if (typePackageFullResolution) {
+                resolved = typePackageFullResolution;
+            }
+        }
+        if (resolved) {
+            return toSearchResult(resolved);
+        }
+    }
 })(ts || (ts = {}));
 var ts;
 (function (ts) {
diff --git a/lib/tsserver.js b/lib/tsserver.js
index 4ea67ec..41c335a 100644
--- a/lib/tsserver.js
+++ b/lib/tsserver.js
@@ -27790,24 +27790,50 @@ var ts;
     ts.getEffectiveTypeRoots = getEffectiveTypeRoots;
     /**
      * Returns the path to every node_modules/@types directory from some ancestor directory.
-     * Returns undefined if there are none.
      */
-    function getDefaultTypeRoots(currentDirectory, host) {
+    function getNodeModulesTypeRoots(currentDirectory, host) {
         if (!host.directoryExists) {
             return [ts.combinePaths(currentDirectory, nodeModulesAtTypes)];
             // And if it doesn't exist, tough.
         }
-        var typeRoots;
+        var typeRoots = [];
         ts.forEachAncestorDirectory(ts.normalizePath(currentDirectory), function (directory) {
             var atTypes = ts.combinePaths(directory, nodeModulesAtTypes);
             if (host.directoryExists(atTypes)) {
-                (typeRoots || (typeRoots = [])).push(atTypes);
+                typeRoots.push(atTypes);
             }
             return undefined;
         });
         return typeRoots;
     }
     var nodeModulesAtTypes = ts.combinePaths("node_modules", "@types");
+    function getPnpTypeRoots(currentDirectory) {
+        if (!isPnpAvailable()) {
+            return [];
+        }
+        var pnpapi = getPnpApi();
+        var locator = pnpapi.findPackageLocator(currentDirectory + "/");
+        var packageDependencies = pnpapi.getPackageInformation(locator).packageDependencies;
+        var typeRoots = [];
+        for (var _i = 0, _a = Array.from(packageDependencies.entries()); _i < _a.length; _i++) {
+            var _b = _a[_i], name = _b[0], referencish = _b[1];
+            // eslint-disable-next-line no-null/no-null
+            if (name.startsWith(typesPackagePrefix) && referencish !== null) {
+                var dependencyLocator = pnpapi.getLocator(name, referencish);
+                var packageLocation = pnpapi.getPackageInformation(dependencyLocator).packageLocation;
+                typeRoots.push(ts.getDirectoryPath(packageLocation));
+            }
+        }
+        return typeRoots;
+    }
+    var typesPackagePrefix = "@types/";
+    function getDefaultTypeRoots(currentDirectory, host) {
+        var nmTypes = getNodeModulesTypeRoots(currentDirectory, host);
+        var pnpTypes = getPnpTypeRoots(currentDirectory);
+        if (nmTypes.length > 0 || pnpTypes.length > 0) {
+            return [].concat(nmTypes, pnpTypes);
+        }
+    }
     /**
      * @param {string | undefined} containingFile - file that contains type reference directive, can be undefined if containing file is unknown.
      * This is possible in case if resolution is performed for directives specified via 'types' parameter. In this case initial path for secondary lookups
@@ -27894,7 +27920,9 @@ var ts;
                 }
                 var result = void 0;
                 if (!ts.isExternalModuleNameRelative(typeReferenceDirectiveName)) {
-                    var searchResult = loadModuleFromNearestNodeModulesDirectory(Extensions.DtsOnly, typeReferenceDirectiveName, initialLocationForSecondaryLookup, moduleResolutionState, /*cache*/ undefined, /*redirectedReference*/ undefined);
+                    var searchResult = isPnpAvailable()
+                        ? tryLoadModuleUsingPnpResolution(Extensions.DtsOnly, typeReferenceDirectiveName, initialLocationForSecondaryLookup, moduleResolutionState)
+                        : loadModuleFromNearestNodeModulesDirectory(Extensions.DtsOnly, typeReferenceDirectiveName, initialLocationForSecondaryLookup, moduleResolutionState, /*cache*/ undefined, /*redirectedReference*/ undefined);
                     result = searchResult && searchResult.value;
                 }
                 else {
@@ -28378,9 +28406,12 @@ var ts;
                 if (traceEnabled) {
                     trace(host, ts.Diagnostics.Loading_module_0_from_node_modules_folder_target_file_type_1, moduleName, Extensions[extensions]);
                 }
-                var resolved_1 = loadModuleFromNearestNodeModulesDirectory(extensions, moduleName, containingDirectory, state, cache, redirectedReference);
-                if (!resolved_1)
+                var resolved_1 = isPnpAvailable()
+                    ? tryLoadModuleUsingPnpResolution(extensions, moduleName, containingDirectory, state)
+                    : loadModuleFromNearestNodeModulesDirectory(extensions, moduleName, containingDirectory, state, cache, redirectedReference);
+                if (!resolved_1) {
                     return undefined;
+                }
                 var resolvedValue = resolved_1.value;
                 if (!compilerOptions.preserveSymlinks && resolvedValue && !resolvedValue.originalPath) {
                     var path = realPath(resolvedValue.path, host, traceEnabled);
@@ -28876,6 +28907,57 @@ var ts;
     function toSearchResult(value) {
         return value !== undefined ? { value: value } : undefined;
     }
+    /**
+     * We only allow PnP to be used as a resolution strategy if TypeScript
+     * itself is executed under a PnP runtime (and we only allow it to access
+     * the current PnP runtime, not any on the disk). This ensures that we
+     * don't execute potentially malicious code that didn't already have a
+     * chance to be executed (if we're running within the runtime, it means
+     * that the runtime has already been executed).
+     * @internal
+     */
+    function isPnpAvailable() {
+        // @ts-ignore
+        return process.versions.pnp;
+    }
+    function getPnpApi() {
+        return require("pnpapi");
+    }
+    function loadPnpPackageResolution(packageName, containingDirectory) {
+        try {
+            return getPnpApi().resolveToUnqualified(packageName, containingDirectory + "/", { considerBuiltins: false });
+        }
+        catch (_a) {
+            // Nothing to do
+        }
+    }
+    function loadPnpTypePackageResolution(packageName, containingDirectory) {
+        return loadPnpPackageResolution(getTypesPackageName(packageName), containingDirectory);
+    }
+    /* @internal */
+    function tryLoadModuleUsingPnpResolution(extensions, moduleName, containingDirectory, state) {
+        var _a = parsePackageName(moduleName), packageName = _a.packageName, rest = _a.rest;
+        var packageResolution = loadPnpPackageResolution(packageName, containingDirectory);
+        var packageFullResolution = packageResolution
+            ? nodeLoadModuleByRelativeName(extensions, ts.combinePaths(packageResolution, rest), /*onlyRecordFailures*/ false, state, /*considerPackageJson*/ true)
+            : undefined;
+        var resolved;
+        if (packageFullResolution) {
+            resolved = packageFullResolution;
+        }
+        else if (extensions === Extensions.TypeScript || extensions === Extensions.DtsOnly) {
+            var typePackageResolution = loadPnpTypePackageResolution(packageName, containingDirectory);
+            var typePackageFullResolution = typePackageResolution
+                ? nodeLoadModuleByRelativeName(Extensions.DtsOnly, ts.combinePaths(typePackageResolution, rest), /*onlyRecordFailures*/ false, state, /*considerPackageJson*/ true)
+                : undefined;
+            if (typePackageFullResolution) {
+                resolved = typePackageFullResolution;
+            }
+        }
+        if (resolved) {
+            return toSearchResult(resolved);
+        }
+    }
 })(ts || (ts = {}));
 /* @internal */
 var ts;
diff --git a/lib/tsserverlibrary.js b/lib/tsserverlibrary.js
index 2897a22..da04c70 100644
--- a/lib/tsserverlibrary.js
+++ b/lib/tsserverlibrary.js
@@ -27940,24 +27940,50 @@ var ts;
     ts.getEffectiveTypeRoots = getEffectiveTypeRoots;
     /**
      * Returns the path to every node_modules/@types directory from some ancestor directory.
-     * Returns undefined if there are none.
      */
-    function getDefaultTypeRoots(currentDirectory, host) {
+    function getNodeModulesTypeRoots(currentDirectory, host) {
         if (!host.directoryExists) {
             return [ts.combinePaths(currentDirectory, nodeModulesAtTypes)];
             // And if it doesn't exist, tough.
         }
-        var typeRoots;
+        var typeRoots = [];
         ts.forEachAncestorDirectory(ts.normalizePath(currentDirectory), function (directory) {
             var atTypes = ts.combinePaths(directory, nodeModulesAtTypes);
             if (host.directoryExists(atTypes)) {
-                (typeRoots || (typeRoots = [])).push(atTypes);
+                typeRoots.push(atTypes);
             }
             return undefined;
         });
         return typeRoots;
     }
     var nodeModulesAtTypes = ts.combinePaths("node_modules", "@types");
+    function getPnpTypeRoots(currentDirectory) {
+        if (!isPnpAvailable()) {
+            return [];
+        }
+        var pnpapi = getPnpApi();
+        var locator = pnpapi.findPackageLocator(currentDirectory + "/");
+        var packageDependencies = pnpapi.getPackageInformation(locator).packageDependencies;
+        var typeRoots = [];
+        for (var _i = 0, _a = Array.from(packageDependencies.entries()); _i < _a.length; _i++) {
+            var _b = _a[_i], name = _b[0], referencish = _b[1];
+            // eslint-disable-next-line no-null/no-null
+            if (name.startsWith(typesPackagePrefix) && referencish !== null) {
+                var dependencyLocator = pnpapi.getLocator(name, referencish);
+                var packageLocation = pnpapi.getPackageInformation(dependencyLocator).packageLocation;
+                typeRoots.push(ts.getDirectoryPath(packageLocation));
+            }
+        }
+        return typeRoots;
+    }
+    var typesPackagePrefix = "@types/";
+    function getDefaultTypeRoots(currentDirectory, host) {
+        var nmTypes = getNodeModulesTypeRoots(currentDirectory, host);
+        var pnpTypes = getPnpTypeRoots(currentDirectory);
+        if (nmTypes.length > 0 || pnpTypes.length > 0) {
+            return [].concat(nmTypes, pnpTypes);
+        }
+    }
     /**
      * @param {string | undefined} containingFile - file that contains type reference directive, can be undefined if containing file is unknown.
      * This is possible in case if resolution is performed for directives specified via 'types' parameter. In this case initial path for secondary lookups
@@ -28044,7 +28070,9 @@ var ts;
                 }
                 var result = void 0;
                 if (!ts.isExternalModuleNameRelative(typeReferenceDirectiveName)) {
-                    var searchResult = loadModuleFromNearestNodeModulesDirectory(Extensions.DtsOnly, typeReferenceDirectiveName, initialLocationForSecondaryLookup, moduleResolutionState, /*cache*/ undefined, /*redirectedReference*/ undefined);
+                    var searchResult = isPnpAvailable()
+                        ? tryLoadModuleUsingPnpResolution(Extensions.DtsOnly, typeReferenceDirectiveName, initialLocationForSecondaryLookup, moduleResolutionState)
+                        : loadModuleFromNearestNodeModulesDirectory(Extensions.DtsOnly, typeReferenceDirectiveName, initialLocationForSecondaryLookup, moduleResolutionState, /*cache*/ undefined, /*redirectedReference*/ undefined);
                     result = searchResult && searchResult.value;
                 }
                 else {
@@ -28528,9 +28556,12 @@ var ts;
                 if (traceEnabled) {
                     trace(host, ts.Diagnostics.Loading_module_0_from_node_modules_folder_target_file_type_1, moduleName, Extensions[extensions]);
                 }
-                var resolved_1 = loadModuleFromNearestNodeModulesDirectory(extensions, moduleName, containingDirectory, state, cache, redirectedReference);
-                if (!resolved_1)
+                var resolved_1 = isPnpAvailable()
+                    ? tryLoadModuleUsingPnpResolution(extensions, moduleName, containingDirectory, state)
+                    : loadModuleFromNearestNodeModulesDirectory(extensions, moduleName, containingDirectory, state, cache, redirectedReference);
+                if (!resolved_1) {
                     return undefined;
+                }
                 var resolvedValue = resolved_1.value;
                 if (!compilerOptions.preserveSymlinks && resolvedValue && !resolvedValue.originalPath) {
                     var path = realPath(resolvedValue.path, host, traceEnabled);
@@ -29026,6 +29057,57 @@ var ts;
     function toSearchResult(value) {
         return value !== undefined ? { value: value } : undefined;
     }
+    /**
+     * We only allow PnP to be used as a resolution strategy if TypeScript
+     * itself is executed under a PnP runtime (and we only allow it to access
+     * the current PnP runtime, not any on the disk). This ensures that we
+     * don't execute potentially malicious code that didn't already have a
+     * chance to be executed (if we're running within the runtime, it means
+     * that the runtime has already been executed).
+     * @internal
+     */
+    function isPnpAvailable() {
+        // @ts-ignore
+        return process.versions.pnp;
+    }
+    function getPnpApi() {
+        return require("pnpapi");
+    }
+    function loadPnpPackageResolution(packageName, containingDirectory) {
+        try {
+            return getPnpApi().resolveToUnqualified(packageName, containingDirectory + "/", { considerBuiltins: false });
+        }
+        catch (_a) {
+            // Nothing to do
+        }
+    }
+    function loadPnpTypePackageResolution(packageName, containingDirectory) {
+        return loadPnpPackageResolution(getTypesPackageName(packageName), containingDirectory);
+    }
+    /* @internal */
+    function tryLoadModuleUsingPnpResolution(extensions, moduleName, containingDirectory, state) {
+        var _a = parsePackageName(moduleName), packageName = _a.packageName, rest = _a.rest;
+        var packageResolution = loadPnpPackageResolution(packageName, containingDirectory);
+        var packageFullResolution = packageResolution
+            ? nodeLoadModuleByRelativeName(extensions, ts.combinePaths(packageResolution, rest), /*onlyRecordFailures*/ false, state, /*considerPackageJson*/ true)
+            : undefined;
+        var resolved;
+        if (packageFullResolution) {
+            resolved = packageFullResolution;
+        }
+        else if (extensions === Extensions.TypeScript || extensions === Extensions.DtsOnly) {
+            var typePackageResolution = loadPnpTypePackageResolution(packageName, containingDirectory);
+            var typePackageFullResolution = typePackageResolution
+                ? nodeLoadModuleByRelativeName(Extensions.DtsOnly, ts.combinePaths(typePackageResolution, rest), /*onlyRecordFailures*/ false, state, /*considerPackageJson*/ true)
+                : undefined;
+            if (typePackageFullResolution) {
+                resolved = typePackageFullResolution;
+            }
+        }
+        if (resolved) {
+            return toSearchResult(resolved);
+        }
+    }
 })(ts || (ts = {}));
 /* @internal */
 var ts;
diff --git a/lib/typescript.js b/lib/typescript.js
index 548ceea..5e0e897 100644
--- a/lib/typescript.js
+++ b/lib/typescript.js
@@ -27929,24 +27929,50 @@ var ts;
     ts.getEffectiveTypeRoots = getEffectiveTypeRoots;
     /**
      * Returns the path to every node_modules/@types directory from some ancestor directory.
-     * Returns undefined if there are none.
      */
-    function getDefaultTypeRoots(currentDirectory, host) {
+    function getNodeModulesTypeRoots(currentDirectory, host) {
         if (!host.directoryExists) {
             return [ts.combinePaths(currentDirectory, nodeModulesAtTypes)];
             // And if it doesn't exist, tough.
         }
-        var typeRoots;
+        var typeRoots = [];
         ts.forEachAncestorDirectory(ts.normalizePath(currentDirectory), function (directory) {
             var atTypes = ts.combinePaths(directory, nodeModulesAtTypes);
             if (host.directoryExists(atTypes)) {
-                (typeRoots || (typeRoots = [])).push(atTypes);
+                typeRoots.push(atTypes);
             }
             return undefined;
         });
         return typeRoots;
     }
     var nodeModulesAtTypes = ts.combinePaths("node_modules", "@types");
+    function getPnpTypeRoots(currentDirectory) {
+        if (!isPnpAvailable()) {
+            return [];
+        }
+        var pnpapi = getPnpApi();
+        var locator = pnpapi.findPackageLocator(currentDirectory + "/");
+        var packageDependencies = pnpapi.getPackageInformation(locator).packageDependencies;
+        var typeRoots = [];
+        for (var _i = 0, _a = Array.from(packageDependencies.entries()); _i < _a.length; _i++) {
+            var _b = _a[_i], name = _b[0], referencish = _b[1];
+            // eslint-disable-next-line no-null/no-null
+            if (name.startsWith(typesPackagePrefix) && referencish !== null) {
+                var dependencyLocator = pnpapi.getLocator(name, referencish);
+                var packageLocation = pnpapi.getPackageInformation(dependencyLocator).packageLocation;
+                typeRoots.push(ts.getDirectoryPath(packageLocation));
+            }
+        }
+        return typeRoots;
+    }
+    var typesPackagePrefix = "@types/";
+    function getDefaultTypeRoots(currentDirectory, host) {
+        var nmTypes = getNodeModulesTypeRoots(currentDirectory, host);
+        var pnpTypes = getPnpTypeRoots(currentDirectory);
+        if (nmTypes.length > 0 || pnpTypes.length > 0) {
+            return [].concat(nmTypes, pnpTypes);
+        }
+    }
     /**
      * @param {string | undefined} containingFile - file that contains type reference directive, can be undefined if containing file is unknown.
      * This is possible in case if resolution is performed for directives specified via 'types' parameter. In this case initial path for secondary lookups
@@ -28033,7 +28059,9 @@ var ts;
                 }
                 var result = void 0;
                 if (!ts.isExternalModuleNameRelative(typeReferenceDirectiveName)) {
-                    var searchResult = loadModuleFromNearestNodeModulesDirectory(Extensions.DtsOnly, typeReferenceDirectiveName, initialLocationForSecondaryLookup, moduleResolutionState, /*cache*/ undefined, /*redirectedReference*/ undefined);
+                    var searchResult = isPnpAvailable()
+                        ? tryLoadModuleUsingPnpResolution(Extensions.DtsOnly, typeReferenceDirectiveName, initialLocationForSecondaryLookup, moduleResolutionState)
+                        : loadModuleFromNearestNodeModulesDirectory(Extensions.DtsOnly, typeReferenceDirectiveName, initialLocationForSecondaryLookup, moduleResolutionState, /*cache*/ undefined, /*redirectedReference*/ undefined);
                     result = searchResult && searchResult.value;
                 }
                 else {
@@ -28517,9 +28545,12 @@ var ts;
                 if (traceEnabled) {
                     trace(host, ts.Diagnostics.Loading_module_0_from_node_modules_folder_target_file_type_1, moduleName, Extensions[extensions]);
                 }
-                var resolved_1 = loadModuleFromNearestNodeModulesDirectory(extensions, moduleName, containingDirectory, state, cache, redirectedReference);
-                if (!resolved_1)
+                var resolved_1 = isPnpAvailable()
+                    ? tryLoadModuleUsingPnpResolution(extensions, moduleName, containingDirectory, state)
+                    : loadModuleFromNearestNodeModulesDirectory(extensions, moduleName, containingDirectory, state, cache, redirectedReference);
+                if (!resolved_1) {
                     return undefined;
+                }
                 var resolvedValue = resolved_1.value;
                 if (!compilerOptions.preserveSymlinks && resolvedValue && !resolvedValue.originalPath) {
                     var path = realPath(resolvedValue.path, host, traceEnabled);
@@ -29015,6 +29046,57 @@ var ts;
     function toSearchResult(value) {
         return value !== undefined ? { value: value } : undefined;
     }
+    /**
+     * We only allow PnP to be used as a resolution strategy if TypeScript
+     * itself is executed under a PnP runtime (and we only allow it to access
+     * the current PnP runtime, not any on the disk). This ensures that we
+     * don't execute potentially malicious code that didn't already have a
+     * chance to be executed (if we're running within the runtime, it means
+     * that the runtime has already been executed).
+     * @internal
+     */
+    function isPnpAvailable() {
+        // @ts-ignore
+        return process.versions.pnp;
+    }
+    function getPnpApi() {
+        return require("pnpapi");
+    }
+    function loadPnpPackageResolution(packageName, containingDirectory) {
+        try {
+            return getPnpApi().resolveToUnqualified(packageName, containingDirectory + "/", { considerBuiltins: false });
+        }
+        catch (_a) {
+            // Nothing to do
+        }
+    }
+    function loadPnpTypePackageResolution(packageName, containingDirectory) {
+        return loadPnpPackageResolution(getTypesPackageName(packageName), containingDirectory);
+    }
+    /* @internal */
+    function tryLoadModuleUsingPnpResolution(extensions, moduleName, containingDirectory, state) {
+        var _a = parsePackageName(moduleName), packageName = _a.packageName, rest = _a.rest;
+        var packageResolution = loadPnpPackageResolution(packageName, containingDirectory);
+        var packageFullResolution = packageResolution
+            ? nodeLoadModuleByRelativeName(extensions, ts.combinePaths(packageResolution, rest), /*onlyRecordFailures*/ false, state, /*considerPackageJson*/ true)
+            : undefined;
+        var resolved;
+        if (packageFullResolution) {
+            resolved = packageFullResolution;
+        }
+        else if (extensions === Extensions.TypeScript || extensions === Extensions.DtsOnly) {
+            var typePackageResolution = loadPnpTypePackageResolution(packageName, containingDirectory);
+            var typePackageFullResolution = typePackageResolution
+                ? nodeLoadModuleByRelativeName(Extensions.DtsOnly, ts.combinePaths(typePackageResolution, rest), /*onlyRecordFailures*/ false, state, /*considerPackageJson*/ true)
+                : undefined;
+            if (typePackageFullResolution) {
+                resolved = typePackageFullResolution;
+            }
+        }
+        if (resolved) {
+            return toSearchResult(resolved);
+        }
+    }
 })(ts || (ts = {}));
 /* @internal */
 var ts;
diff --git a/lib/typescriptServices.js b/lib/typescriptServices.js
index 9046c6f..7d0d7a9 100644
--- a/lib/typescriptServices.js
+++ b/lib/typescriptServices.js
@@ -27929,24 +27929,50 @@ var ts;
     ts.getEffectiveTypeRoots = getEffectiveTypeRoots;
     /**
      * Returns the path to every node_modules/@types directory from some ancestor directory.
-     * Returns undefined if there are none.
      */
-    function getDefaultTypeRoots(currentDirectory, host) {
+    function getNodeModulesTypeRoots(currentDirectory, host) {
         if (!host.directoryExists) {
             return [ts.combinePaths(currentDirectory, nodeModulesAtTypes)];
             // And if it doesn't exist, tough.
         }
-        var typeRoots;
+        var typeRoots = [];
         ts.forEachAncestorDirectory(ts.normalizePath(currentDirectory), function (directory) {
             var atTypes = ts.combinePaths(directory, nodeModulesAtTypes);
             if (host.directoryExists(atTypes)) {
-                (typeRoots || (typeRoots = [])).push(atTypes);
+                typeRoots.push(atTypes);
             }
             return undefined;
         });
         return typeRoots;
     }
     var nodeModulesAtTypes = ts.combinePaths("node_modules", "@types");
+    function getPnpTypeRoots(currentDirectory) {
+        if (!isPnpAvailable()) {
+            return [];
+        }
+        var pnpapi = getPnpApi();
+        var locator = pnpapi.findPackageLocator(currentDirectory + "/");
+        var packageDependencies = pnpapi.getPackageInformation(locator).packageDependencies;
+        var typeRoots = [];
+        for (var _i = 0, _a = Array.from(packageDependencies.entries()); _i < _a.length; _i++) {
+            var _b = _a[_i], name = _b[0], referencish = _b[1];
+            // eslint-disable-next-line no-null/no-null
+            if (name.startsWith(typesPackagePrefix) && referencish !== null) {
+                var dependencyLocator = pnpapi.getLocator(name, referencish);
+                var packageLocation = pnpapi.getPackageInformation(dependencyLocator).packageLocation;
+                typeRoots.push(ts.getDirectoryPath(packageLocation));
+            }
+        }
+        return typeRoots;
+    }
+    var typesPackagePrefix = "@types/";
+    function getDefaultTypeRoots(currentDirectory, host) {
+        var nmTypes = getNodeModulesTypeRoots(currentDirectory, host);
+        var pnpTypes = getPnpTypeRoots(currentDirectory);
+        if (nmTypes.length > 0 || pnpTypes.length > 0) {
+            return [].concat(nmTypes, pnpTypes);
+        }
+    }
     /**
      * @param {string | undefined} containingFile - file that contains type reference directive, can be undefined if containing file is unknown.
      * This is possible in case if resolution is performed for directives specified via 'types' parameter. In this case initial path for secondary lookups
@@ -28033,7 +28059,9 @@ var ts;
                 }
                 var result = void 0;
                 if (!ts.isExternalModuleNameRelative(typeReferenceDirectiveName)) {
-                    var searchResult = loadModuleFromNearestNodeModulesDirectory(Extensions.DtsOnly, typeReferenceDirectiveName, initialLocationForSecondaryLookup, moduleResolutionState, /*cache*/ undefined, /*redirectedReference*/ undefined);
+                    var searchResult = isPnpAvailable()
+                        ? tryLoadModuleUsingPnpResolution(Extensions.DtsOnly, typeReferenceDirectiveName, initialLocationForSecondaryLookup, moduleResolutionState)
+                        : loadModuleFromNearestNodeModulesDirectory(Extensions.DtsOnly, typeReferenceDirectiveName, initialLocationForSecondaryLookup, moduleResolutionState, /*cache*/ undefined, /*redirectedReference*/ undefined);
                     result = searchResult && searchResult.value;
                 }
                 else {
@@ -28517,9 +28545,12 @@ var ts;
                 if (traceEnabled) {
                     trace(host, ts.Diagnostics.Loading_module_0_from_node_modules_folder_target_file_type_1, moduleName, Extensions[extensions]);
                 }
-                var resolved_1 = loadModuleFromNearestNodeModulesDirectory(extensions, moduleName, containingDirectory, state, cache, redirectedReference);
-                if (!resolved_1)
+                var resolved_1 = isPnpAvailable()
+                    ? tryLoadModuleUsingPnpResolution(extensions, moduleName, containingDirectory, state)
+                    : loadModuleFromNearestNodeModulesDirectory(extensions, moduleName, containingDirectory, state, cache, redirectedReference);
+                if (!resolved_1) {
                     return undefined;
+                }
                 var resolvedValue = resolved_1.value;
                 if (!compilerOptions.preserveSymlinks && resolvedValue && !resolvedValue.originalPath) {
                     var path = realPath(resolvedValue.path, host, traceEnabled);
@@ -29015,6 +29046,57 @@ var ts;
     function toSearchResult(value) {
         return value !== undefined ? { value: value } : undefined;
     }
+    /**
+     * We only allow PnP to be used as a resolution strategy if TypeScript
+     * itself is executed under a PnP runtime (and we only allow it to access
+     * the current PnP runtime, not any on the disk). This ensures that we
+     * don't execute potentially malicious code that didn't already have a
+     * chance to be executed (if we're running within the runtime, it means
+     * that the runtime has already been executed).
+     * @internal
+     */
+    function isPnpAvailable() {
+        // @ts-ignore
+        return process.versions.pnp;
+    }
+    function getPnpApi() {
+        return require("pnpapi");
+    }
+    function loadPnpPackageResolution(packageName, containingDirectory) {
+        try {
+            return getPnpApi().resolveToUnqualified(packageName, containingDirectory + "/", { considerBuiltins: false });
+        }
+        catch (_a) {
+            // Nothing to do
+        }
+    }
+    function loadPnpTypePackageResolution(packageName, containingDirectory) {
+        return loadPnpPackageResolution(getTypesPackageName(packageName), containingDirectory);
+    }
+    /* @internal */
+    function tryLoadModuleUsingPnpResolution(extensions, moduleName, containingDirectory, state) {
+        var _a = parsePackageName(moduleName), packageName = _a.packageName, rest = _a.rest;
+        var packageResolution = loadPnpPackageResolution(packageName, containingDirectory);
+        var packageFullResolution = packageResolution
+            ? nodeLoadModuleByRelativeName(extensions, ts.combinePaths(packageResolution, rest), /*onlyRecordFailures*/ false, state, /*considerPackageJson*/ true)
+            : undefined;
+        var resolved;
+        if (packageFullResolution) {
+            resolved = packageFullResolution;
+        }
+        else if (extensions === Extensions.TypeScript || extensions === Extensions.DtsOnly) {
+            var typePackageResolution = loadPnpTypePackageResolution(packageName, containingDirectory);
+            var typePackageFullResolution = typePackageResolution
+                ? nodeLoadModuleByRelativeName(Extensions.DtsOnly, ts.combinePaths(typePackageResolution, rest), /*onlyRecordFailures*/ false, state, /*considerPackageJson*/ true)
+                : undefined;
+            if (typePackageFullResolution) {
+                resolved = typePackageFullResolution;
+            }
+        }
+        if (resolved) {
+            return toSearchResult(resolved);
+        }
+    }
 })(ts || (ts = {}));
 /* @internal */
 var ts;
diff --git a/lib/typingsInstaller.js b/lib/typingsInstaller.js
index 776a2e0..26e5510 100644
--- a/lib/typingsInstaller.js
+++ b/lib/typingsInstaller.js
@@ -27779,24 +27779,50 @@ var ts;
     ts.getEffectiveTypeRoots = getEffectiveTypeRoots;
     /**
      * Returns the path to every node_modules/@types directory from some ancestor directory.
-     * Returns undefined if there are none.
      */
-    function getDefaultTypeRoots(currentDirectory, host) {
+    function getNodeModulesTypeRoots(currentDirectory, host) {
         if (!host.directoryExists) {
             return [ts.combinePaths(currentDirectory, nodeModulesAtTypes)];
             // And if it doesn't exist, tough.
         }
-        var typeRoots;
+        var typeRoots = [];
         ts.forEachAncestorDirectory(ts.normalizePath(currentDirectory), function (directory) {
             var atTypes = ts.combinePaths(directory, nodeModulesAtTypes);
             if (host.directoryExists(atTypes)) {
-                (typeRoots || (typeRoots = [])).push(atTypes);
+                typeRoots.push(atTypes);
             }
             return undefined;
         });
         return typeRoots;
     }
     var nodeModulesAtTypes = ts.combinePaths("node_modules", "@types");
+    function getPnpTypeRoots(currentDirectory) {
+        if (!isPnpAvailable()) {
+            return [];
+        }
+        var pnpapi = getPnpApi();
+        var locator = pnpapi.findPackageLocator(currentDirectory + "/");
+        var packageDependencies = pnpapi.getPackageInformation(locator).packageDependencies;
+        var typeRoots = [];
+        for (var _i = 0, _a = Array.from(packageDependencies.entries()); _i < _a.length; _i++) {
+            var _b = _a[_i], name = _b[0], referencish = _b[1];
+            // eslint-disable-next-line no-null/no-null
+            if (name.startsWith(typesPackagePrefix) && referencish !== null) {
+                var dependencyLocator = pnpapi.getLocator(name, referencish);
+                var packageLocation = pnpapi.getPackageInformation(dependencyLocator).packageLocation;
+                typeRoots.push(ts.getDirectoryPath(packageLocation));
+            }
+        }
+        return typeRoots;
+    }
+    var typesPackagePrefix = "@types/";
+    function getDefaultTypeRoots(currentDirectory, host) {
+        var nmTypes = getNodeModulesTypeRoots(currentDirectory, host);
+        var pnpTypes = getPnpTypeRoots(currentDirectory);
+        if (nmTypes.length > 0 || pnpTypes.length > 0) {
+            return [].concat(nmTypes, pnpTypes);
+        }
+    }
     /**
      * @param {string | undefined} containingFile - file that contains type reference directive, can be undefined if containing file is unknown.
      * This is possible in case if resolution is performed for directives specified via 'types' parameter. In this case initial path for secondary lookups
@@ -27883,7 +27909,9 @@ var ts;
                 }
                 var result = void 0;
                 if (!ts.isExternalModuleNameRelative(typeReferenceDirectiveName)) {
-                    var searchResult = loadModuleFromNearestNodeModulesDirectory(Extensions.DtsOnly, typeReferenceDirectiveName, initialLocationForSecondaryLookup, moduleResolutionState, /*cache*/ undefined, /*redirectedReference*/ undefined);
+                    var searchResult = isPnpAvailable()
+                        ? tryLoadModuleUsingPnpResolution(Extensions.DtsOnly, typeReferenceDirectiveName, initialLocationForSecondaryLookup, moduleResolutionState)
+                        : loadModuleFromNearestNodeModulesDirectory(Extensions.DtsOnly, typeReferenceDirectiveName, initialLocationForSecondaryLookup, moduleResolutionState, /*cache*/ undefined, /*redirectedReference*/ undefined);
                     result = searchResult && searchResult.value;
                 }
                 else {
@@ -28367,9 +28395,12 @@ var ts;
                 if (traceEnabled) {
                     trace(host, ts.Diagnostics.Loading_module_0_from_node_modules_folder_target_file_type_1, moduleName, Extensions[extensions]);
                 }
-                var resolved_1 = loadModuleFromNearestNodeModulesDirectory(extensions, moduleName, containingDirectory, state, cache, redirectedReference);
-                if (!resolved_1)
+                var resolved_1 = isPnpAvailable()
+                    ? tryLoadModuleUsingPnpResolution(extensions, moduleName, containingDirectory, state)
+                    : loadModuleFromNearestNodeModulesDirectory(extensions, moduleName, containingDirectory, state, cache, redirectedReference);
+                if (!resolved_1) {
                     return undefined;
+                }
                 var resolvedValue = resolved_1.value;
                 if (!compilerOptions.preserveSymlinks && resolvedValue && !resolvedValue.originalPath) {
                     var path = realPath(resolvedValue.path, host, traceEnabled);
@@ -28865,6 +28896,57 @@ var ts;
     function toSearchResult(value) {
         return value !== undefined ? { value: value } : undefined;
     }
+    /**
+     * We only allow PnP to be used as a resolution strategy if TypeScript
+     * itself is executed under a PnP runtime (and we only allow it to access
+     * the current PnP runtime, not any on the disk). This ensures that we
+     * don't execute potentially malicious code that didn't already have a
+     * chance to be executed (if we're running within the runtime, it means
+     * that the runtime has already been executed).
+     * @internal
+     */
+    function isPnpAvailable() {
+        // @ts-ignore
+        return process.versions.pnp;
+    }
+    function getPnpApi() {
+        return require("pnpapi");
+    }
+    function loadPnpPackageResolution(packageName, containingDirectory) {
+        try {
+            return getPnpApi().resolveToUnqualified(packageName, containingDirectory + "/", { considerBuiltins: false });
+        }
+        catch (_a) {
+            // Nothing to do
+        }
+    }
+    function loadPnpTypePackageResolution(packageName, containingDirectory) {
+        return loadPnpPackageResolution(getTypesPackageName(packageName), containingDirectory);
+    }
+    /* @internal */
+    function tryLoadModuleUsingPnpResolution(extensions, moduleName, containingDirectory, state) {
+        var _a = parsePackageName(moduleName), packageName = _a.packageName, rest = _a.rest;
+        var packageResolution = loadPnpPackageResolution(packageName, containingDirectory);
+        var packageFullResolution = packageResolution
+            ? nodeLoadModuleByRelativeName(extensions, ts.combinePaths(packageResolution, rest), /*onlyRecordFailures*/ false, state, /*considerPackageJson*/ true)
+            : undefined;
+        var resolved;
+        if (packageFullResolution) {
+            resolved = packageFullResolution;
+        }
+        else if (extensions === Extensions.TypeScript || extensions === Extensions.DtsOnly) {
+            var typePackageResolution = loadPnpTypePackageResolution(packageName, containingDirectory);
+            var typePackageFullResolution = typePackageResolution
+                ? nodeLoadModuleByRelativeName(Extensions.DtsOnly, ts.combinePaths(typePackageResolution, rest), /*onlyRecordFailures*/ false, state, /*considerPackageJson*/ true)
+                : undefined;
+            if (typePackageFullResolution) {
+                resolved = typePackageFullResolution;
+            }
+        }
+        if (resolved) {
+            return toSearchResult(resolved);
+        }
+    }
 })(ts || (ts = {}));
 /* @internal */
 var ts;
`.trim();
