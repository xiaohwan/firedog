function addColumnToHierachey(objs, parent) {
	if (!parent) {
		resetHierachey();
		var ul = $('ul#hierachey');
	} else {
		var ul = $('ul#children-' + parent);
	}
	if (objs.length > LENGTH_TO_CONFIRM) {
		if (!window.confirm('Adding ' + objs.length + ' objects to the hierachey. Large numbers of objects will make profiler very slow, continue?')) {
			return;
		}
	}
	$(objs).each(function(index, obj) {
		var li = $('<li><h3 id="' + obj.id + '"><a href="#expose" id="' + obj.id + '" class="icon">+</a><a href="#expose" id="' + obj.id + '" class="hide icon">-</a> <a href="#object-detail" id="' + obj.id + '">' + getObjectName(obj) + '</a></h3><ul id="children-' + obj.id + '" class="ref-list hide"></ul></li>');
		ul.append(li);
	});
}
function render(data) {
	document.body.innerHTML = JSON.stringify(data);
}

