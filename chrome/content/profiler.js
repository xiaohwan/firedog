function doProfiling() {
	var interestClass = {
		'Object': true,
		'Call': true,
		'Function': true
	};
	var windows = {};
	var namedObjects = getNamedObjects();
	var cross = true;
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
		namedObjects[name] = id;
	}
	for (var p in namedObjects) {
		windows[namedObjects[p]] = true;
	}
	var table = getObjectTable();
	var objs = {};
	for (var p in table) {
		var parent = getObjectParent(parseInt(p));
		if (cross || (p in windows) || (parent in windows)) {
			objs[p] = getObjectInfo(parseInt(p));
			if (objs[p].nativeClass in interestClass) {
				objs[p].properties = getObjectProperties(parseInt(p));
			}
		} else {
		}
	}
	return objs;
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
}
(function() {
	var result;
	try {
		result = {
			success: true,
			data: doProfiling()
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
