var Content = (function() {
	const LENGTH_TO_CONFIRM = 20;
	const MAX_TAB_NUM = 10;

	var hierachey = null;
	var detail = null;
	var hieracheyData = [];
	var snapshot = null;

	// NOTE: add jsxid, jsxclass, jsxname to object info if it's a GI object;
	// TODO: support user-defined decorator "if has property A, enable decorateA";
	function decorateGIObject(obj) {
		try {
			if (!obj.jsxclass && obj.properties) {
				var __jsxclass = obj.properties['__jsxclass__'];
				if (!__jsxclass && ! obj.allProps) {
					obj.allProps = getAllProperties(obj.prototype);
				}
				__jsxclass = obj.allProps['__jsxclass__'] || obj.allProps['__jsxclass'];
				if (__jsxclass) {
					__jsxclass = searchById(__jsxclass);
					if (__jsxclass && __jsxclass.properties) {
						var jsxclass = searchById(__jsxclass.properties['jsxclass']);
						if (jsxclass) {
							obj.jsxclass = jsxclass.properties._name || jsxclass.properties.JM;
						}
					}
				}
			}
			if (!obj.jsxname && obj.properties) {
				obj.jsxname = obj.properties.jsxname;
				obj.jsxid = obj.properties._jsxid;
			}
			if (obj.jsxname || obj.jsxid || obj.jsxclass) {
				var name = ' (';
				if (obj.jsxclass) {
					name += '@' + obj.jsxclass + ' ';
				}
				if (obj.jsxname || obj.jsxid) {
					name += obj.jsxid + '/' + obj.jsxname;
				}
				name += ')';
				obj.giname = name;
			}
		} catch(ex) {
			alert(1);
		}
	}

	function getSnapshot() {
		return Content.panel.getSnapshot(snapshot);
	}

	function getObjectName(obj) {
		var name = obj.id + ' ' + obj.nativeClass;
		// TODO: select decorator automatically by properties;
		decorateGIObject(obj);
		if (obj.giname) {
			name += obj.giname;
		}
		return name;
	}

	// NOTE: get all properties including properties in prototypes;
	function getAllProperties(id) {
		var props = {};
		var obj = searchById(id);
		if (obj) {
			if (obj.prototype) {
				var protoProps = getAllProperties(obj.prototype);
				for (p in protoProps) {
					props[p] = protoProps[p];
				}
			}
			if (obj.properties) {
				for (var p in obj.properties) {
					props[p] = obj.properties[p];
				}
			}
		}
		return props;
	}

	function searchById(id) {
		var profile = getSnapshot().data;
		return profile[id];
	}

	function addColumnToHierachey(objs, parent) {
		if (!parent) {
			resetHierachey();
			var ul = hierachey
		} else {
			var ul = $('ul.children-' + parent + '.empty');
		}
		if (objs.length > LENGTH_TO_CONFIRM) {
			if (!window.confirm('Adding ' + objs.length + ' objects to the hierachey. Large numbers of objects will make profiler very slow, continue?')) {
				return;
			}
		}
		var html = '';
		$(objs).each(function(index, obj) {
			html += '<li id="' + obj.id + '"><h3 class="object-parent"><span class="open-icon"></span><span class="link object-name">' + getObjectName(obj) + '</span></h3><ul class="empty children-' + obj.id + ' ref-list hide"></ul></li>';
		});
		ul.removeClass('empty').append($(html));
	}

	// NOTE: return objects that has "child" in children list;
	// NOTE: children is a reference relationship. A is B's children means A refers B (mostly B is the value of a
	//       property of A);
	function searchObjectsByChildren(child) {
		try {
			var profile = getSnapshot().data;
			child = parseInt(child);
			var objs = [];
			for (var p in profile) {
				if (profile[p].children && profile[p].children.indexOf(child) > - 1) {
					objs.push(profile[p]);
				}
			}
			return objs;
		} catch(ex) {
			alert(ex);
		}
	}

	function resetHierachey() {
		hieracheyData = [];
		hierachey.empty();
	}

	function wrapObjectIdHtml(id) {
		if (typeof(id) == 'object') {
			for (var html = '', i = 0; i < id.length; i++) {
				html += '<span class="object-id link">' + id[i] + '</span> '
			}
			return html;
		} else {
			return '<span class="object-id link">' + id + '</span> ';
		}
	}
	function ifObjectId(str) {
		return str in getSnapshot().data;
	}

	// NOTE: get object detail html;
	function getObjectDescription(obj) {
		try {
			if (typeof(obj) == 'object') {
				var desc = ['<h4>Basic Info</h4>', 'Native Class: ', obj.nativeClass, '<br />', 'Size: ', obj.size, '<br />', 'Scope: ', wrapObjectIdHtml(obj.parent), '<br />', 'Prototype: ', wrapObjectIdHtml(obj.prototype), '<br />', 'Refering: ', wrapObjectIdHtml(obj.children)];
				desc.push('<h4>Properties</h4>');
				if (obj.properties) {
					for (var p in obj.properties) {
						desc = desc.concat([p, ' => ', ifObjectId(obj.properties[p]) ? wrapObjectIdHtml(obj.properties[p]) : obj.properties[p] + '', '<br />']);
					}
				} else {
					desc.push('No property of this object is profiled. It maybe because this type "' + obj.nativeClass + '" is not added to the list of "interested types.". You can add it by editing /content/profiler.js in extension folder.');
				}
				if (!obj.allProps) {
					obj.allProps = getAllProperties(obj.prototype);
				}
				desc.push('<h4>Properties in prototypes</h4>');
				for (p in obj.allProps) {
					// NOTE: property is in prorotype but not this object;
					if (! (p in obj.properties)) {
						desc = desc.concat([p, ' => ', ifObjectId(obj.allProps[p]) ? wrapObjectIdHtml(obj.allProps[p]) : obj.allProps[p] + '', '<br />']);
					}
				}
				if (obj.nativeClass == 'Function') {
					desc = desc.concat(['<h4>Function Info</h4>', 'Name: ', obj.name, '<br />', 'File Name: ', obj.filename, '<br />', 'Function Size: ', obj.functionSize, '<br />', 'Script Size: ', obj.scriptSize, '<br />', 'Line Start: ', obj.lineStart, '<br />', 'Line End: ', obj.lineEnd]);
				}

				return '<div id="tab-' + obj.id + '" class="object-details">' + desc.join('') + '</div>';
			} else if (typeof(obj) == 'string') {
				return '<h4>No detailed info</h4>';
			}
		} catch(ex) {
			alert(2);
		}
	}

	// NOTE: show object detail by a jquery tab;
	function showObjectDetail(id) {
		if (!$('#tab-' + id).size()) {
			if ($('#detail > ul > li').size() >= MAX_TAB_NUM) {
				alert('You can view details of 10 objects at a time. Please close some tabs.');
			} else {
				var obj = searchById(id);
				var html = getObjectDescription(obj);
				$(html).appendTo('#detail');
				$('#detail').tabs('add', '#tab-' + id, id, 0);
				$('#detail').tabs('select', 0);
			}
		} else {
			var li = $('a[href=#tab-' + id + ']').parent();
			var lis = li.parent().children();
			var index = lis.index(li);
			$('#detail').tabs('select', index);
		}
	}

	return {
		showObjects: function(objs) {
			try {
				addColumnToHierachey(objs);
			} catch(ex) {
				alert(ex);
			}
		},
		initialize: function() {
			hierachey = $('ul#hierachey');
			$('#hierachey h3 span.open-icon').live('click', function(evt) {
				try {
					var li = $(this).closest('li');
					var h3 = $(this).closest('h3');
					var id = li.attr('id');
					if (li.parent().closest('li#' + id).size()) {
						// TODO: scroll to;
						alert('object is open in the reference chain. it\'s a loop reference.');
					} else {
						h3.toggleClass('open');
						if (h3.hasClass('open')) {
							if (!hieracheyData[id]) {
								hieracheyData[id] = searchObjectsByChildren(id);
							}
							addColumnToHierachey(hieracheyData[id], id);
							h3.next('ul').toggleClass('hide');
						}
					}
				} catch(ex) {
					alert(ex);
				}
			});
			$('.object-name').live('click', function(evt) {
				try {
					var id = $(this).closest('li').attr('id');
					showObjectDetail(id);
				} catch(ex) {
					alert(ex);
				}
			});
			$('.object-id').live('click', function(evt) {
				try {
					var id = $(this).text();
					showObjectDetail(id);
				} catch(ex) {
					alert(ex);
				}
			});
			$('#detail').tabs({
				show: function(evt, ui) {
					try {
						var id = $(ui.tab).find('span').text();
						$('#hierachey h3').removeClass('active');
						$('#hierachey li#' + id + ' > h3').addClass('active');
					} catch(ex) {
						alert(ex);
					}
				}
			});
			$('#detail li.ui-tabs-selected').live('dblclick', function(evt) {
				try {
					var ul = $(this).parent();
					var lis = ul.children();
					var index = lis.index($(this));
					$('#detail').tabs('remove', index);
				} catch(ex) {
					alert(ex);
				}
			});
		},
		setSnapshot: function(s) {
			snapshot = s;
		},
		log: function(log) {
			if (typeof(log) == 'object') {
				log = JSON.stringify(log);
			}
			$('#log').text(log);
		}
	};
})();
$(document).ready(function() {
	Content.initialize();
});

