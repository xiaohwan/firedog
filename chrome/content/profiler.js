/**
 * NOTE:
 * 
 */
function doProfiling() {
	argument = JSON.parse(argument);
	var PROFILE_CLOSURE = argument.PROFILE_CLOSURE;		// NOTE: if profile on the objects in closure, if not, only profile on
														//       objects in window scope; otherwise analyse all scopes in target window;
	var PROFILE_PROPERTY = argument.PROFILE_PROPERTY;	// NOTE: if false, won't get properties info of objects, therefore
														//       can not compare between snapshots becasue no identifier ...
														//       however, you can still trace object by reference if we get a
														//       (TODO) TREE VIEW FROM TOP TO BOTTOM in the future;

	var interestedTypes = argument.INTERESTED_TYPES;	// TODO: intersested types should be customizable;
														//       if null, profile on all types;
	var scopes = {};
	var namedObjects = getNamedObjects();
	var table = getObjectTable();
	// NOTE: get scope id for all objects;
	var count_all = 0;				// NOTE: count number of objects. ONLY FOR SELT-DEBUGGING;
	var p = null;
	for (p in table) {
		table[p] = getObjectParent(parseInt(p));
		scopes[table[p]] = false;	// NOTE: index all scopes, set default (if in target window) to false;
		count_all ++;
	}
	var count_scope = 0;
	var count_targetScope = 0;
	for (p in scopes) {
		count_scope ++;
	}
	// NOTE: get scopes for window and iframes;
	for (p in namedObjects) {
		var id = namedObjects[p];
		var info = getObjectInfo(id);
		while (info.wrappedObject) {
			id = info.wrappedObject;
			info = getObjectInfo(info.wrappedObject);
		}
		if (info.innerObject) {
			id = info.innerObject;
		}
		scopes[id] = true;			// NOTE: here we get all window scopes (also iframes);
		count_targetScope ++;
	}

	// NOTE: get all scopes in target window (window, closures ...)
	var ancestor = null;
	var pc = null; 					// NOTE: record scopes chain (scopes chain) of an object;
	var nonTargetScopes = {};
	var flag = false;

	for (var p in table) {
		ancestor = table[p];
		if (ancestor) {
			if (!scopes[ancestor] && !nonTargetScopes[ancestor]) {
				pc = {};
				do {
					pc[ancestor] = true;
					ancestor = table[ancestor];
					if (scopes[ancestor]) {
						for (var pp in pc) {
							scopes[pp] = true;
							count_targetScope ++;
						}
						break;
					} else if (!ancestor || (nonTargetScopes[ancestor])) {
						for (var pp in pc) {
							nonTargetScopes[pp] = true;
						}
						break;
					}
				} while (ancestor && (!pc[ancestor])); // NOTE: could scopes be a loop?
				// TODO: scopes loop?
			}
		} else {
			nonTargetScopes[p] = true;
		}
	}

	// NOTE:
	var count_detail = 0;
	var count_property = 0;
	var objs = {};
	for (p in table) {
		p = parseInt(p);
		if (scopes[p] || scopes[table[p]]) {
			count_detail ++;
			objs[p] = getObjectInfo(p);
			if (!interestedTypes || (objs[p].nativeClass in interestedTypes)) {
				count_property ++;
				objs[p].properties = getObjectProperties(p);
			}
		} else {}
	}
	return {
		data: objs,
		info: {count: {all: count_all, scope: count_scope, targetScope: count_targetScope, detail: count_detail, property: count_property}, argument: argument}
	};
}
// This function uses the Python-inspired traceback functionality of the
// profiling runtime to return a stack trace that looks much like Python's.
function getTraceback(frame) {
	var lines = [];
	if (frame === undefined) frame = stack();
	while (frame) {
		var line = ('  File "' + frame.filename + '", line ' + frame.lineNo + ', in ' + frame.functionName);
		lines.splice(0, 0, line);
		frame = frame.caller;
	}
	lines.splice(0, 0, "Traceback (most recent call last):");
	return lines.join('\n');
} (function() {
	var result;
	try {
		var r = doProfiling();
		result = {
			success: true,
			data: r.data,
			info: r.info
		};
	} catch(e) {
		result = {
			success: false,
			traceback: getTraceback(lastExceptionTraceback),
			error: String(e)
		};
	}
	return JSON.stringify(result);
})();

