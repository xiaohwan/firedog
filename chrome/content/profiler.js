function doProfiling() {
	var interestClass = {
		'Object': true,
		'Call': true,
		'Function': true,
		'Array': true,
		'Window': true,
		'Error': true
	};
	var windows = {};
	var namedObjects = getNamedObjects();
	var cross = true;
	var parents = {};
	for (var name in namedObjects) {
		cross = false;
		var id = namedObjects[name];
		var info = getObjectInfo(id);
		while (info.wrappedObject) {
			id = info.wrappedObject;
			info = getObjectInfo(info.wrappedObject);
		}
		if (info.innerObject) {
			id = info.innerObject;
		}
		parents[id] = true;
	}
	// NOTE: get parent id for all objects;
	var table = getObjectTable();
	for (p in table) {
		table[p] = getObjectParent(parseInt(p));
	}
	// NOTE: get all scopes (parent) in target window;
	var ancestor = null;
	var pc = null; // NOTE: parents chain (scopes chain);
	var notparents = {};
	var flag = false;

	for (var p in table) {
		p = parseInt(p);
		ancestor = table[p];
		if (ancestor) {
			if (!parents[ancestor] && !notparents[ancestor]) {
				pc = {};
				do {
					pc[ancestor] = true;
					ancestor = table[ancestor];
					if (parents[ancestor]) {
						for (var pp in pc) {
							parents[pp] = true;
						}
						break;
					} else if (!ancestor || (notparents[ancestor])) {
						for (var pp in pc) {
							notparents[pp] = true;
						}
						break;
					}
				} while (ancestor && (!pc[ancestor])); // NOTE: could scopes be a loop?
				// TODO: scopes loop?
			}
		} else {
			notparents[p] = true;
		}
	}

	// NOTE:
	var objs = {};
	for (p in table) {
		p = parseInt(p);
		if (cross || parents[p] || parents[table[p]]) {
			objs[p] = getObjectInfo(p);
			if (objs[p].nativeClass in interestClass) {
				objs[p].properties = getObjectProperties(p);
			}
		} else {}
	}
	return {
		data: objs,
		info: parents
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

