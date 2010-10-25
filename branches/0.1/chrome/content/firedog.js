FBL.ns(function() {
	/*** Definations ***/
	const PANEL = 'Firedog';

	const Cc = Components.classes;
	const Ci = Components.interfaces;
	const Cu = Components.utils;

	const EXTENSION_ID = 'firedog@lab.nuttycoder.com';
	const PROFILE_FILE_NAME = 'profiler.js';	// NOTE: code for profiling; 
												//       see http://hg.mozilla.org/labs/jetpack-sdk/file/tip/packages/nsjetpack/docs/nsjetpack.md
	const CACHE_FILE_NAME = 'snapshots.tmp';	// NOTE: I'm using a cache file to save serialized snapshots before take another snapshot
												//       because those snapshots objects could be also profiled;
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

	/*** Snapshot Class ***/
	var Snapshot = function(id, title, data) {
		this.id = id;
		this.title = title;
		this.data = data;
	};
	// NOTE: deserialize cached snapshots;
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

	/*** Content Class ***/
	// NOTE: I'm using an embeded html page to present results;
	//	     Snapshots are passed to embeded html, all single snapshot based operation like search, getObjectDetail happens in embeded page;
	//       Content is used for load the html page and setup interface object to panel;
	// TODO: refactor this content proxy;
	var Content = (function() {
		var path = 'chrome://firedog/content/firedog.content.report.html';

		// NOTE: using a async callback to set content handler;
		//       a setTimeout loop is because onload of the iframe is not invoked;
		// TODO: why iframe.onload doesn't work?
		var Constructor = function(container, cb) {
			container.innerHTML = '<iframe id="report" src="' + path + '" style="border:none;overflow:hidden;width:100%;height:100%;padding:0;margin:0;"></iframe>';
			var iframe = container.children[0];
			var bContentReady = function() {
				if (iframe.contentWindow.Content) {
					// NOTE: inject a puber;
					cb(iframe.contentWindow.Content);
				} else {
					setTimeout(function() {
						bContentReady();
					},
					0);
				}
			};
			bContentReady();
		};
		return Constructor;
	})();

	// NOTE: jetpack prototype is required;
	function getBinaryComponent() {
		try {
			var factory = Cc["@labs.mozilla.com/jetpackdi;1"].createInstance(Ci.nsIJetpack);
			return factory.get();
		} catch(ex) {
			ERRS.push(ex);
		}
	}
	// NOTE: get current call stack by throwing an exception and catching it;
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
	// NOTE: read and write local file;
	//       io.js is required;
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
	/*** End of definations ***/
	const PROFILE_CODE = readFile(PROFILE_FILE);
	const Com = getBinaryComponent();
	/*** initialize ***/
	var ERRS = [];			// NOTE: cache exceptions in a collection of errors because string can't display in the initialize process of module;
	var firedog = {};		// NOTE: the object I injected to client window; {observe, unobserve, profile(todo)};
	// NOTE: relationship between snapshots and contexts and panels are based the same index in these array:
	//       context of panels[index] is contexts[index];
	//       snapshots of contexts[index] is snapshots[index] which is an array with all snapshots;
	var snapshots = [];
	var contexts = [];
	var panels = [];

	with(FBL) {
		Firebug.Firedog = extend(Firebug.Module, {
			// NOTE: initContext is invoked after a page is load/reload;
			initContext: function(context, persistedState) {
				Firebug.Module.initContext.apply(this, arguments);
				try {
					snapshots[contexts.length] = [];
					contexts.push(context);
					this.initWatchdog();	// NOTE: setup firedog.observe, firedog.unobserve;
					this.injectFiredog(context);	// NOTE: inject firedog to client window;
				} catch(ex) {
					ERRS.push(ex);
				}
			},
			// NOTE: invoked when switch between switch panels;
			//       also invoked when show a browser tab;
			showPanel: function(browser, panel) {
				try {
					var isFdPanel = panel && (panel.name == PANEL);
					var fdButtons = browser.chrome.$('fbFiredogButtons');
					panel.model = this;
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
			// NOTE: invoked when close/reload a page; we clear all stored data on destroyContext;
			destroyContext: function(context, persistedState) {
				panels.splice(contexts.indexOf(context), 1);
				snapshots.splice(contexts.indexOf(context), 1);
				contexts.splice(contexts.indexOf(context), 1);
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
					var ss = snapshots[contexts.indexOf(context)];
					ss.push(new Snapshot(ss.length, (ss.length + 1) + ' @ ' + startTime.toTimeString().split(' ')[0], result.data));
				} else {
					alert(JSON.stringify(result));
				}
			},
			compareSnapshots: function(snapshot1, snapshot2, id) {
				var objs = [],
				s1 = {};
				// NOTE: default identifier for GI;
				id = id || '_jsxid';
				// NOTE: index object info in snapshot1 by identifier;
				for (var p in snapshot1) {
					if (snapshot1[p].properties && snapshot1[p].properties[id]) {
						s1[snapshot1[p].properties[id]] = snapshot1[p];
					}
				}
				// NOTE: walk through all objects in snapshot2 to see if the value of identifier property is in s1;
				for (p in snapshot2) {
					if (snapshot2[p].properties && snapshot2[p].properties[id]) {
						if (snapshot2[p].properties[id] in s1) {} else {
							objs.push(snapshot2[p]);
						}
					}
				}
				return objs;
			},
			/*** UI event hanlders ***/
			onTakeSnapshot: function(context) {
				try {
					this.profile(context);
					panels[contexts.indexOf(context)].onNewSnapshot();
				} catch(ex) {
					alert(ex);
				}
			},
			onCheckCompareTo: function(context) {
				try {
					panels[contexts.indexOf(context)].toggleCompareToMenuEnabled();
				} catch(ex) {
					alert(ex);
				}
			},
			onCompare: function(context) {
				try {
					var panel = panels[contexts.indexOf(context)];
					var info = panel.getCompareSetup();
					var _snapshots = snapshots[contexts.indexOf(context)];
					snapshot1 = _snapshots[info[1]].data;
					snapshot2 = _snapshots[info[0]].data;
					panel.showCompareResults(this.compareSnapshots(snapshot1, snapshot2, info[2]));
				} catch(ex) {
					alert(ex);
				}
			},
			/*** Watchdog: {observe, unobserve} ***/
			initWatchdog: function() {
				try {
					var targetObjects = [];
					var targetAttributes = [];
					var resolving = false;

					// NOTE: attrMembrane include the additional methods we add to a wrapped object;
					//       see http://hg.mozilla.org/labs/jetpack-sdk/file/tip/packages/nsjetpack/docs/nsjetpack.md for details;
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
					// NOTE: observe;
					firedog.observe = function(target, setter, targetAttribute, handlers) {
						try {
							var pos = targetObjects.indexOf(target);
							if (pos == - 1) {
								var wrapped = Com.wrap(target, attrMembrane);
								setter(wrapped);
								pos = targetObjects.push(target) - 1;
								targetAttributes[pos] = {};
							}
							targetAttributes[pos][targetAttribute] = (handlers || {});
							return wrapped;
						} catch(ex) {
							alert(ex);
						}
					};
					firedog.unobserve = function(wrappedObject, setter, targetAttribute) {
						try {
							var wrappee = Com.unwrap(wrappedObject);
							if (wrappee) {
								var pos = targetObjects.indexOf(wrappee);
								if (pos > - 1) {
									delete(targetAttributes[pos][targetAttribute]);
								}
							} else {
								alert('Firedog: a wrapped object should be passed to firedog.unobserve.');
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
			getIndex: function() {
				return contexts.indexOf(this.context);
			},
			initialize: function() {
				try {
					Firebug.Panel.initialize.apply(this, arguments);
					// NOTE:
					panels[this.getIndex()] = this;
					// NOTE:
					this.menu1 = $('fdSnapshotMenu');
					this.menu2 = $('fdCompareToMenu');
					this.popup1 = $('fdSnapshotMenuPopup');
					this.popup2 = $('fdCompareToMenuPopup');
					this.identifier = $('fdIdentifierProperty');
					this.menuPanel = $('fdSnapshotMenuPanel');
					this.comparePanel = $('fdCompareMenuPanel');
					this.chk = $('fdCompareCheck');
					this.compare = $('fdCompare');

					this.compareChecked = false;

					// NOTE: to improve ...
					var me = this;
					Content(this.panelNode, function(content) {
						me.content = content;
					});
				} catch(ex) {
					alert(ex);
				}
			},
			toggleCompareToMenuEnabled: function() {
				// NOTE: all panels share the same toolbar, so ... we need record UI status of toolbar in panel instance;
				this.compareChecked = !this.compareChecked;

				this.menu2.disabled = ! this.menu2.disabled;
				this.compare.disabled = ! this.compare.disabled;
			},
			showCompareResults: function(result) {
				this.content.showObjects(result);
			},
			getSelectSnapshot: function() {
				return this.chk.checked ? this.menu2.selectedIndex: this.menu1.selectedIndex;
			},
			getCompareSetup: function() {
				// TODO:
				return [this.menu1.selectedIndex, this.menu2.selectedIndex, this.identifier.value];
			},
			onNewSnapshot: function() {
				var items = snapshots[this.getIndex()];
				var neuu = items[items.length - 1];
				this.content.setSnapshot(neuu);
				this.updateSnapshotMenu();
			},
			updateSnapshotMenu: function() {
				var items = snapshots[contexts.indexOf(this.context)];
				if (items && items.length) {
					FBL.eraseNode(this.popup1);
					FBL.eraseNode(this.popup2);
					for (var i = 0, len = items.length; i < len; i++) {
						FBL.createMenuItem(this.popup1, {
							value: i,
							label: items[i].title,
							type: 'radio'
						});
						FBL.createMenuItem(this.popup2, {
							value: i,
							label: items[i].title,
							type: 'radio'
						});
					}
					this.menu1.selectedIndex = len - 1;
					if (items.length > 1) {
						this.menu2.selectedIndex = len - 2;
						this.chk.checked = this.compareChecked;
						this.menu2.disabled = !this.compareChecked;
						this.compare.disabled = !this.compareChecked;
						collapse(this.comparePanel, false);
					} else {
						collapse(this.comparePanel, true);
					}
					collapse(this.menuPanel, false);
				} else {
					collapse(this.menuPanel, true);
				}
			}
		});
		Firebug.registerPanel(FiredogPanel);
		Firebug.registerModule(Firebug.Firedog);
	};
});
