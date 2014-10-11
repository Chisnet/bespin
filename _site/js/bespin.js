// Bespin
var bespin = window.bespin || {};
bespin = {
	status: 'disconnected',
	server_url: '',
	view_type: 'alias',
	nodes: {},
	aliases: {},
	indices: {},
	shards: {
		successful: 0,
		failed: 0,
		total: 0
	},
	templates: {
		alias_view: {
			alias: _.template(
				'<div class="alias">\
					<div class="name"><%= name %></div>\
					<div class="inner">\
					<% _.each(indices, function(index) { %>\
						<%= indexTemplate(index) %>\
					<% }); %>\
					</div>\
				</div>'
			),
			index: _.template(
				'<div class="index index-<%= index.name %>" data-name="<%= index.name %>">\
					<div class="name"><%= index.name %></div>\
					<div class="info docs">Documents: <%= index.docs %></div>\
					<div class="info size">Size: <%= index.size %></div>\
				</div>'
			)
		},
		table_view: {
			table: _.template(
				'<table cellpadding="0" cellspacing="0">\
					<thead></thead>\
					<tbody></tbody>\
				</table>'
			),
			node: _.template(
				'<th class="node">\
					<span class="name"><%= name %></span><br/>\
					<span class="hostname"><%= hostname %></span>\
				</th>'
			),
			index: _.template(
				'<th class="index">\
					<span class="name"><%= name %></span><br/>\
					<span class="info docs">Documents: <%= docs %></span><br/>\
					<span class="info size">Size: <%= size %></span>\
				</th>'
			)
		}
	},

	init: function(){
		// Get the view type first so when we connect we can render immediately in the correct view
        var cookieViewType = $.cookie('view_type');
        if (cookieViewType !== undefined) {
        	$('#viewType').val(cookieViewType);
        	this.view_type = cookieViewType;
        }
		var cookieURL = $.cookie('server_url');
        if (cookieURL !== undefined) {
            $('#connectionURL').val(cookieURL);
            this.connect(cookieURL);
        }
	},
	connect: function(url) {
		$('#connectionStatus').removeClass().addClass('unknown').text('Connecting...');
		bespin.status = 'connecting';
		bespin.server_url = url;
		$.cookie("server_url", url, { expires:7, path:'/' });
		bespin.refresh();
	},
	refresh: function() {
		bespin.es_request('status');
		if(bespin.status == 'connected') {
			bespin.es_request('nodes');
			bespin.es_request('aliases');
			bespin.organize_data();
			for(var i in bespin.index_keys){
				bespin.es_request('segments', bespin.index_keys[i]);
			}
			bespin.draw_indices();
		}
		else {
			// TODO: Clean up data / displays
		}
	},
	es_request: function(request_name, index_name) {
		var request_path = bespin.server_url;
		if(typeof(index_name) != 'undefined') {
			request_path += index_name + '/'
		}
		var request_type = 'GET';

		var accepted_request_types = ['status', 'nodes', 'aliases', 'segments'];
		if(!request_name.indexOf(accepted_request_types)) {
			console.log('Unknown Request!');
			return;
		}
		request_path += '_' + request_name;

		$.ajax({
			async: false,
			url: request_path,
			type: request_type
		}).done(function(data){
			bespin.process_response(request_name, index_name, data);
		}).fail(function(){
			bespin.process_response(request_name, index_name, false);
		});
	},
	process_response: function(request_name, index_name, data) {
		switch(request_name) {
			case 'status':
				if(data) {
					bespin.status = 'connected';
					bespin.shards.successful = data._shards.successful;
					bespin.shards.failed = data._shards.failed;
					bespin.shards.total = data._shards.total;
					bespin.indices = data.indices;

					var connected_message = 'Connected';
					var connected_status = 'ok';
					connected_message += ' (' + bespin.shards.successful + ' of ' + bespin.shards.total + ' shards)';
					if(bespin.shards.failed > 0){connected_status = 'warning';}
					$('#connectionStatus').removeClass().addClass(connected_status).text(connected_message);
				} else {
					bespin.status = 'error';
					$('#connectionStatus').removeClass().addClass('error').text('Connection Error!');
				}
				break;
			case 'nodes':
				if(data) {
					bespin.nodes = data.nodes;
				}
				else {
					console.log('Error retrieving nodes!');
				}
				break;
			case 'aliases':
				if(data) {
					var aliases = {
						'NONE': []
					};
					for(var index in data) {
						if(Object.keys(data[index].aliases).length) {
							for(var alias in data[index].aliases) {
								if(!aliases[alias]) {
									aliases[alias] = [];
								}
								aliases[alias].push(index);
							}
						}
						else {
							aliases['NONE'].push(index);
						}
					}
					bespin.aliases = aliases;
				} else {
					console.log('Error retrieving aliases!');
				}
				break;
			case 'segments':
				if(data) {
					if(typeof(index_name) != 'undefined') {
						// We're dealing with an individual index
						bespin.indices[index_name]._shards = data._shards;
					}
				}
				else {
					console.log('Error retrieving segments!');
				}
				break;
			default:
				console.log('Unknown Response!');
				break;
		}
	},
	organize_data: function() {
		bespin.alias_keys = Object.keys(bespin.aliases).sort();
		bespin.index_keys = Object.keys(bespin.indices).sort();
		bespin.node_keys = Object.keys(bespin.nodes).sort();
	},
	draw_indices: function() {
		$('#content_indices').empty();
		$('#content_indices').removeClass('alias_view vertical_view horizontal_view').addClass(this.view_type+'_view');

		// Check if we require an "Unassigned" node
		var require_unassigned = false;
		for(var key in bespin.index_keys) {
			var index_name = bespin.index_keys[key];
			var index = bespin.indices[index_name];
			if((index._shards.successful + index._shards.failed) < index._shards.total) {
				require_unassigned = true;
			}
		}

		switch(this.view_type) {
			case 'alias':
				for(var key in bespin.alias_keys) {
					var alias = bespin.alias_keys[key];
					if(alias != 'NONE') {
						var data = {
							name: alias,
							indices: [],
							indexTemplate: bespin.templates.alias_view.index
						};
						var indices = bespin.aliases[alias].sort();
						for(var index in indices) {
							var index_name = bespin.aliases[alias][index];
							var index_data = {
								index: bespin.build_index_object(index_name)
							};
							data.indices.push(index_data);
						};

						var output = bespin.templates.alias_view.alias(data);
						$('#content_indices').append(output)
					}
				}
				for(var key in bespin.alias_keys) {
					var alias = bespin.alias_keys[key];
					if(alias == 'NONE') {
						var indices = bespin.aliases[alias].sort();
						for(var index in indices) {
							var index_name = bespin.aliases[alias][index];
							var index_data = {
								index: bespin.build_index_object(index_name)
							};
							var output = bespin.templates.alias_view.index(index_data);
							$('#content_indices').append(output);
						}
					}
				}
				$('#content_indices .index').bind('mouseenter', function() {
					var index_name = $(this).data('name');
					$('#content_indices .index-'+index_name).addClass('highlight');
				}).bind('mouseleave', function() {
					$('#content_indices .index').removeClass('highlight');
				});
				break;
			case 'vertical':
				var $output = $(bespin.templates.table_view.table());

				// Pre-form data
				var output_data = {};

				// Build header
				var $tHeader = $('<tr></tr>');
				$tHeader.append($('<th></th>')); // Empty corner cell
				for(var node in bespin.nodes) {
					var node_info = bespin.nodes[node];
					var output = bespin.templates.table_view.node({
						name: node_info.name,
						hostname: node_info.hostname || node_info.host
					});
					$tHeader.append(output);
					if(require_unassigned) {
						var output = bespin.templates.table_view.node({
							name: 'Unassigned',
							hostname: 'n/a'
						});
						$tHeader.append(output)
					}
				}
				$output.find('thead').append($tHeader);

				// Build content
				for(var key in bespin.index_keys) {
					var index_name = bespin.index_keys[key];
					var index = bespin.indices[index_name];
					var $indexRow = $('<tr></tr>');

					// Add the index name
					var output = bespin.templates.table_view.index({
						name: index_name,
						docs: index.docs.num_docs,
						size: index.index.primary_size || (index.index.primary_size_in_bytes + ' Bytes')
					});
					$indexRow.append(output);

					for(var node_index in bespin.node_keys) {
						var node = bespin.node_keys[node_index];
						var $node_html = $('<td class="shards"></td>');
						for(var shard in index.shards) {
							if(node == index.shards[shard][0].routing.node) {
								//TODO - Identify status for colouring
								$node_html.append('<div>'+shard+'</div>');
							}
						}
						$indexRow.append($node_html);
					}

					// Unassigned
					if(require_unassigned) {
						var $node_html = $('<td class="shards"></td>');
						var unassigned = index._shards.total - index._shards.successful - index._shards.failed;
						for(var i=0; i<unassigned; i++) {
							$node_html.append('<div class="unassigned">'+i+'</div>');
						}
						$indexRow.append($node_html);
					}

					$output.find('tbody').append($indexRow);
				}

				// Write to DOM
				$('#content_indices').append($output);
				break;
			case 'horizontal':
				var output = bespin.templates.table_view.table();
				$('#content_indices').append(output);
				break;
		}
	},
	build_index_object: function(index_name) {
		var index_data = bespin.indices[index_name];
		return {
			name: index_name,
			docs: index_data ? index_data.docs.num_docs : 'unknown',
			size: index_data ? index_data.index.primary_size : 'unknown',
		}
	}
};

// Bind events
$(function(){
	bespin.init();
	$('#connectionButton').bind('click', function() {
		var connectionURL = $('#connectionURL').val();
		bespin.connect(connectionURL);
	});
	$('#refreshButton').bind('click', function() {
		bespin.refresh();
	});
	$('#viewType').bind('change', function() {
		var view_type = $(this).val();
		$.cookie("view_type", view_type, { expires:7, path:'/' });
		bespin.view_type = view_type;
		bespin.draw_indices();
	});
	$('.tab').bind('click', function() {
		var content_type = $(this).data('content');
		$(this).addClass('active').siblings().removeClass('active');
		$('#content_'+content_type).addClass('active').siblings().removeClass('active');
	});
});