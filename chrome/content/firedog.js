FBL.ns(function() {
	// NOTE: initialize;
	const PANEL = 'Firedog';

	const Cc = Components.classes;
	const Ci = Components.interfaces;
	const Cu = Components.utils;

	const EXTENSION_ID = 'firedog@lab.nuttycoder.com';
	const PROFILE_FILE_NAME = 'profiler.js';
	const CACHE_FILE_NAME = 'snapshots.tmp';
	const MAX_APP_NAME_LEN = 30;

	const EXT_MANAGER = Cc['@mozilla.org/extensions/manager;1'].getService(Components.interfaces.nsIExtensionManager);
	const LOC = EXT_MANAGER.getInstallLocation(EXTENSION_ID);
	// NOTE:
	var CACHE_FILE = LOC.getItemLocation(EXTENSION_ID);
	CACHE_FILE.append(CACHE_FILE_NAME);
	// NOTE:
	var PROFILE_FILE = LOC.getItemLocation(EXTENSION_ID);
	PROFILE_FILE.append('chrome');
	PROFILE_FILE.append('content');
	PROFILE_FILE.append(PROFILE_FILE_NAME);

	var Snapshot = function(id, title, data) {
		this.id = id;
		this.title = title;
		this.data = data;
	};
	Snapshot.restore = function(str) {
		var arr = JSON.parse(str);
		var snapshots = [];
		for (var i = 0; i < arr.length; i++) {
			snapshots[i] = [];
			for (var ii = 0; ii < arr[i].length; ii++) {
				snapshots[i].push(new Snapshot(arr[i][ii].id, arr[i][ii].title, arr[i][ii].data));
			}
		}
		return snapshots;
	};
	Snapshot.prototype = {
		searchByProperty: function(prop) {
			try {
				var objs = [];
				var profile = this.data;

				for (var p in profile) {
					if (profile[p].properties && (prop in profile[p].properties)) {
						objs.push(profile[p]);
					}
				}
				Ui.log('Search by property "' + prop + '": ' + objs.length + ' objects found.');
				return objs;
			} catch(ex) {
				Ui.log(ex, ERROR);
			}
		}
	};

	function getBinaryComponent() {
		try {
			var factory = Cc["@labs.mozilla.com/jetpackdi;1"].createInstance(Ci.nsIJetpack);
			return factory.get();
		} catch(ex) {
			ERRS.push(ex);
		}
	}
	function getCallStack() {
		try {
			i.dont.exist += 0;
		} catch(ex) {
			var stack = [];
			var lines = ex.stack.split('\n');
			for (var i = 2, len = lines.length; i < len; i++) {
				stack.push(lines[i]);
			}
			return stack;
		}
	}
	function readFile(file) {
		try {
			return FileIO.read(file, 'utf-8');
		} catch(ex) {
			ERRS.push(ex);
		}
	}
	function writeFile(file, data) {
		FileIO.write(file, JSON.stringify(data), null, 'utf-8');
	}

	const PROFILE_CODE = readFile(PROFILE_FILE);
	const Com = getBinaryComponent();
	var ERRS = [];
	var firedog = {};
	var snapshots = [];
	var contexts = [];
	var panels = [];

	with(FBL) {
		Firebug.Firedog = extend(Firebug.Module, {
			initContext: function(context, persistedState) {
				Firebug.Module.initContext.apply(this, arguments);
				try {
					snapshots[contexts.length] = [];
					contexts.push(context);
					this.initWatchdog();
					this.injectFiredog(context);
				} catch(ex) {
					ERRS.push(ex);
				}
			},
			showPanel: function(browser, panel) {
				try {
					var isFdPanel = panel && (panel.name == PANEL);
					var fdButtons = browser.chrome.$('fbFiredogButtons');
					if (isFdPanel) {
						collapse(fdButtons, false);
						panel.updateSnapshotMenu();
					} else {
						collapse(fdButtons, true);
					}
				} catch(ex) {
					alert(ex);
				}
			},
			destroyContext: function(context, persistedState) {
				snapshots.splice(contexts.indexOf(context), 1);
				contexts.splice(contexts.indexOf(context), 1);
			},
			onSelectSnapshot: function(evt, context) {
			},
			profile: function(context) {
				// NOTE: cache snapshots by disk file and remove objects in snapshots from JS context
				//       in case of objects in snapshots are profiled again.
				writeFile(CACHE_FILE, snapshots);
				snapshots = null;

				// NOTE: force GC;
				Components.utils.forceGC();

				// NOTE: profiling;
				var startTime = new Date();

				// NOTE: nsJetpack.profileMemory(code, filename, lineNumber, namedObjects, argument);
				//       set http://hg.mozilla.org/labs/jetpack-sdk/file/tip/packages/nsjetpack/docs/nsjetpack.md
				var targetWindow = unwrapObject(context.window);
				var result = Com.profileMemory(PROFILE_CODE, PROFILE_FILE, 1, [targetWindow]);

				var totalTime = (new Date()) - startTime;

				// NOTE: deserialize snapshots from disk cache;
				snapshots = Snapshot.restore(readFile(CACHE_FILE));

				// NOTE: parse profiling results;
				result = JSON.parse(result);
				if (result.success) {
					// NOTE: push new results to snapshots collection;
					snapshots[contexts.indexOf(context)].push(new Snapshot(snapshots.length, targetWindow.name.slice(0, MAX_APP_NAME_LEN) + ' @ ' + startTime.toTimeString(), result.data));
				} else {
					alert(JSON.stringify(result));
				}
			},
			onTakeSnapshot: function(context) {
				try {
					this.profile(context);
					panels[contexts.indexOf(context)].updateSnapshotMenu();
				} catch(ex) {
					alert(ex);
				}
			},
			initWatchdog: function() {
				try {
					var targetObjects = [];
					var targetAttributes = [];
					var resolving = false;

					var attrMembrane = {
						convert: function(wrappee, wrapped, type) {
							return wrappee.valueOf();
						},
						resolve: function(wrappee, wrapped, attr) {
							if (wrappee[attr] !== undefined) {
								resolving = true;
								wrapped[attr] = wrappee[attr];
								resolving = false;
								return wrapped;
							} else {
								return undefined;
							}
						},
						enumerate: function(wrappee, wrapped) {
							return Iterator(wrappee, true);
						},
						iteratorObject: function(wrappee, wrapped, keysOnly) {
							return Iterator(wrappee, keysOnly);
						},
						getProperty: function(wrappee, wrapped, attr, def) {
							return def;
						},
						setProperty: function(wrappee, wrapped, attr, value) {
							if (!resolving) {
								try {
									var pos = targetObjects.indexOf(wrappee);
									if (pos > - 1) {
										if (attr in targetAttributes[pos]) {
											if (targetAttributes[pos][attr].onSet) {
												if (targetAttributes[pos][attr].onSet(wrappee[attr], value, getCallStack()) === false) {
													return wrappee[attr];
												}
											} else {
												// NOTE: default callback;
												alert(attr + ' is set to ' + value + '.\n(You can overwrite this default callback by adding "onSet" property in the forth parameter when setup observer.)');
												alert('call stack: \n' + getCallStack());
											}
										}
									}
								} catch(ex) {
									alert(ex);
								}
								wrappee[attr] = value;
							}
							return value;
						},
						delProperty: function(wrappee, wrapped, attr) {
							try {
								var pos = targetObjects.indexOf(wrappee);
								if (pos > - 1) {
									if (attr in targetAttributes[pos]) {
										if (targetAttributes[pos][attr].onDelete) {
											if (targetAttributes[pos][attr].onDelete(wrappee[attr], getCallStack()) === false) {
												return false;
											}
										} else {
											// NOTE: default callback;
											alert(attr + ' is deleted. \n(You can overwrite this default callback by adding "onSet" property in the forth parameter when setup observer.)');
											alert('call stack: \n' + getCallStack());
										}
									}
								}
							} catch(ex) {
								alert(ex);
							}
							delete(wrappee[attr]);
							return true;
						}
					};
					firedog.__observe__ = function(getter, setter, targetAttribute, handlers) {
						try {
							var targetObject = getter();
							var pos = targetObjects.indexOf(targetObject);
							if (pos == - 1) {
								setter(Com.wrap(targetObject, attrMembrane));
								pos = targetObjects.push(targetObject) - 1;
								targetAttributes[pos] = {};
							}
							targetAttributes[pos][targetAttribute] = (handlers || {});
						} catch(ex) {
							alert(ex);
						}
					};
					firedog.__unobserve__ = function(getter, setter, targetAttribute) {
						try {
							var wrappee = Com.unwrap(getter());
							if (wrappee) {
								var pos = targetObjects.indexOf(wrappee);
								if (pos > - 1) {
									delete(targetAttributes[pos][targetAttribute]);
								}
							}
						} catch(ex) {
							alert(ex);
						}
					};
				} catch(ex) {
					ERRS.push(ex);
				}
			},
			injectFiredog: (function() {
				return function(context) {
					try {
						unwrapObject(context.window).firedog = firedog;
					} catch(ex) {
						ERRS.push(ex);
					}
				};
			})()
		});
		function FiredogPanel() {}
		FiredogPanel.prototype = extend(Firebug.Panel, {
			name: 'Firedog',
			title: 'Firedog',
			initialize: function() {
				Firebug.Panel.initialize.apply(this, arguments);
				panels[contexts.indexOf(this.context)] = this;
			},
			updateSnapshotMenu: function() {
				var items = snapshots[contexts.indexOf(this.context)];
				var popup = $('fdSnapshotMenuPopup');
				var menu = $('fdSnapshotMenu');
				if (items && items.length) {
					FBL.eraseNode(popup);
					for (var i = 0, len = items.length; i < len; i ++) {
						FBL.createMenuItem(popup, {
							value: i,
							label: items[i].title,
							type: 'radio'
						});
					}
					menu.selectedIndex = len - 1;
					collapse(menu, false);
				} else {
					collapse(menu, true);
				}
			}
		});
		Firebug.registerPanel(FiredogPanel);
		Firebug.registerModule(Firebug.Firedog);
	};
});

