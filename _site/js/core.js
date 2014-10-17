// Bespin Core
var bespin = window.bespin || {};
$.extend(bespin, {
	// Define variables
	status: 'disconnected',
	server_url: '',
	view_type: 'alias',
	nodes: {},
	aliases: {},
	indices: {},
	node_keys: [],
	alias_keys: [],
	index_keys: [],
	shards: {
		successful: 0,
		failed: 0,
		total: 0
	},
	unassigned_nodes: false,

	init: function(){
		// Get the view type first so when we connect we can render immediately in the correct view
        var cookieViewType = $.cookie('view_type');
        if (cookieViewType !== undefined) {
        	$('#view_type').val(cookieViewType);
        	this.view_type = cookieViewType;
        }
        // Attempt to grab the last connection URL from cookie, and connect, otherwise don't try connecting
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
		// Refresh all content
		bespin.refresh();
	},
	refresh: function() {
		// Attempt to get ES status
		bespin.es_request('status');
		// If we successfully get a good status request all other data and organise/render it
		if(bespin.status == 'connected') {
			bespin.es_request('nodes');
			bespin.es_request('cluster/state');
			bespin.organize_data();
			bespin.draw_overview();
			bespin.build_index_browser();
		}
		else {
			// TODO: Clean up data / displays
		}
	},
	es_request: function(request_name, index_name, additional_path, params) {
		// Build the base request path
		var request_path = bespin.server_url;
		if(typeof(index_name) != 'undefined') {
			request_path += index_name + '/';
		}
		if(typeof(additional_path) != 'undefined') {
			request_path += additional_path + '/';
		}
		// Set the request type, currently we're only sending GET requests
		var request_type = 'GET';

		// Sanity check the request, probably not really needed
		var accepted_request_names = ['status', 'nodes', 'cluster/state', 'search'];
		if(!request_name.indexOf(accepted_request_names)) {
			console.log('Unknown Request!');
			return;
		}
		// Add the specific request to the path
		request_path += '_' + request_name;

		// Add any query params if required
		if(typeof(params) == 'object') {
			params = $.param(params);
			request_path += '?' + params;
		}

		// Send the request to Elastic Search
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
		// Handle the response from Elastic Search based on the request that was sent
		switch(request_name) {
			case 'status':
				if(data) {
					// If we successfully get data back from a status request update the UI to show we've
					// established a connection and store some initial data
					bespin.status = 'connected';
					bespin.shards.successful = data._shards.successful;
					bespin.shards.failed = data._shards.failed;
					bespin.shards.total = data._shards.total;
					bespin.indices = data.indices;

					var connected_message = 'Connected';
					var connected_status = 'ok';
					connected_message += ' (' + bespin.shards.successful + ' of ' + bespin.shards.total + ' shards)';
					// Work out the status highlight colour based off the shard information retrieved
					if(bespin.shards.total > (bespin.shards.successful + bespin.shards.failed)){connected_status = 'warning';}
					if(bespin.shards.failed > 0){connected_status = 'error';}
					$('#connectionStatus').removeClass().addClass(connected_status).text(connected_message);
				} else {
					bespin.status = 'error';
					$('#connectionStatus').removeClass().addClass('error').text('Connection Error!');
				}
				break;
			case 'nodes':
				if(data) {
					// Node response just goes straight into our local object
					bespin.nodes = data.nodes;
				}
				else {
					console.log('Error retrieving nodes!');
				}
				break;
			case 'cluster/state':
				if(data) {
					// Extract alias and mapping information
					var aliases = {'NONE': []};
					_.each(data.metadata.indices, function(index_obj, index_name){
						// Alias information is a bit hard to process in it's raw form, so we need to organise it
						if(_.keys(index_obj.aliases).length) {
							_.each(index_obj.aliases, function(alias){
								if(!aliases[alias]) {
									aliases[alias] = [];
								}
								aliases[alias].push(index_name);
							});
						}
						else {
							aliases['NONE'].push(index_name);
						}
						// Mappings are ncie and clean and go straight into our object
						bespin.indices[index_name].mappings = index_obj.mappings;
					});
					bespin.aliases = aliases;

					// Extract shard information
					_.each(data.routing_table.indices, function(routing, index){
						bespin.indices[index].shards = routing.shards;
					});
				}
				else {
					console.log('Error retrieving cluster state!');
				}
				break;
			case 'search':
				if(data) {
					bespin.build_browser_results(data);
				}
				else {
					console.log('Error performing search!');
				}
				break;
			default:
				console.log('Unknown Response!');
				break;
		}
	},
	organize_data: function() {
		// To facilitate loops we grab and pre-sort the alias, index and node names
		bespin.alias_keys = Object.keys(bespin.aliases).sort();
		bespin.index_keys = Object.keys(bespin.indices).sort();
		bespin.node_keys = Object.keys(bespin.nodes).sort();
		if((bespin.shards.successful + bespin.shards.failed) < bespin.shards.total) {
			bespin.unassigned_nodes = true;
		}
	},
	draw_overview: function() {
		$('#content_overview').empty();
		$('#content_overview').removeClass('alias_view vertical_view horizontal_view').addClass(this.view_type+'_view');

		switch(this.view_type) {
			case 'alias':
				_.each(bespin.alias_keys, function(alias){
					if(alias != 'NONE') {
						var data = {
							name: alias,
							indices: [],
							indexTemplate: bespin.templates.alias_view.index
						};
						var indices = bespin.aliases[alias].sort();
						_.each(indices, function(index_name){
							var index_data = {
								index: bespin.build_index_object(index_name)
							};
							data.indices.push(index_data);
						});
						var output = bespin.templates.alias_view.alias(data);
						$('#content_overview').append(output)
					}
				});
				_.each(bespin.alias_keys, function(alias){
					if(alias == 'NONE') {
						var indices = bespin.aliases[alias].sort();

						_.each(indices, function(index_name){
							var index_data = {
								index: bespin.build_index_object(index_name)
							};
							var output = bespin.templates.alias_view.index(index_data);
							$('#content_overview').append(output);
						});
					}
				});
				$('#content_overview .index').bind('mouseenter', function() {
					var index_name = $(this).data('name');
					$('#content_overview .index-'+index_name).addClass('highlight');
				}).bind('mouseleave', function() {
					$('#content_overview .index').removeClass('highlight');
				});
				break;
			case 'vertical':
				var $output = $(bespin.templates.table_view.table());

				// Pre-form data
				var output_data = {};

				// Build header
				var $tHeader = $('<tr></tr>');
				$tHeader.append($('<th></th>')); // Empty corner cell
				_.each(bespin.nodes, function(node){
					var output = bespin.templates.table_view.node({
						name: node.name,
						hostname: node.hostname || node.host
					});
					$tHeader.append(output);
					if(bespin.unassigned_nodes) {
						var output = bespin.templates.table_view.node({
							name: 'Unassigned',
							hostname: 'n/a'
						});
						$tHeader.append(output)
					}
				});
				$output.find('thead').append($tHeader);

				// Build content
				_.each(bespin.index_keys, function(index_name){
					var index = bespin.indices[index_name];
					var $indexRow = $('<tr></tr>');

					// Add the index name
					var output = bespin.templates.table_view.index({
						name: index_name,
						docs: index.docs.num_docs,
						size: index.index.primary_size || (index.index.primary_size_in_bytes + ' Bytes')
					});
					$indexRow.append(output);

					// Assigned shards
					_.each(bespin.node_keys, function(node){
						var $node_html = $('<td class="shards"></td>');
						_.each(index.shards, function(node_shards, shard_num){
							_.each(node_shards, function(node_shard){
								if(node == node_shard.node) {
									// TODO - Identify status for colouring
									$node_html.append('<div>'+shard_num+'</div>');
								}
							});
						});
						$indexRow.append($node_html);
					});

					// Unassigned shards
					if(bespin.unassigned_nodes) {
						var $node_html = $('<td class="shards"></td>');
						_.each(index.shards, function(node_shards, shard_num){
							_.each(node_shards, function(node_shard){
								if(node_shard.state == 'UNASSIGNED') {
									$node_html.append('<div class="unassigned">'+shard_num+'</div>');
								}
							});
						});
						$indexRow.append($node_html);
					}

					$output.find('tbody').append($indexRow);
				});

				// Write to DOM
				$('#content_overview').append($output);
				break;
			case 'horizontal':
				var output = bespin.templates.table_view.table();
				$('#content_overview').append(output);
				break;
		}
	},
	build_index_object: function(index_name) {
		// Builds an object to pass into the underscore template when rendering the alias overview
		var index_data = bespin.indices[index_name];
		return {
			name: index_name,
			docs: index_data ? index_data.docs.num_docs : 'unknown',
			size: index_data ? index_data.index.primary_size : 'unknown',
		}
	},
	build_index_browser: function() {
		var $index_dropdown = $('#browser_indices');
		$index_dropdown.empty();
		$index_dropdown.append('<option value="">--</option>');
		var alias_count = bespin.alias_keys.length;
		if(bespin.alias_keys.indexOf('NONE') > -1) {
			alias_count -= 1;
		}
		if(alias_count > 0) {
			var $opt_group = $('<optgroup label="Aliases"></optgroup>');
			_.each(bespin.alias_keys, function(alias_name){
				if(alias_name != 'NONE') {
					$opt_group.append('<option value="alias_'+alias_name+'">'+alias_name+'</option>');
				}
			});
			$index_dropdown.append($opt_group);
		}
		if(bespin.index_keys.length) {
			var $opt_group = $('<optgroup label="Indices"></optgroup>');
			_.each(bespin.index_keys, function(index_name){
				$opt_group.append('<option value="index_'+index_name+'">'+index_name+'</option>');
			});
			$index_dropdown.append($opt_group);
		}
	},
	build_type_browser: function(index_type, index_name) {
		var $type_dropdown = $('#browser_types');
		$type_dropdown.empty();
		$type_dropdown.append('<option value="">--</option>');
		if(index_type == 'alias') {
			_.each(bespin.aliases[index_name], function(alias_index_name){
				var mappings = bespin.indices[alias_index_name].mappings;
				var type_list = [];
				_.each(mappings, function(mapping_data, mapping_name){
					type_list.push(mapping_name);
				});
				_.each(type_list, function(mapping_name){
					$type_dropdown.append('<option value="'+mapping_name+'">'+mapping_name+'</option>');
				});
			});
		}
		else {
			var mappings = bespin.indices[index_name].mappings;
			_.each(mappings, function(mapping_data, mapping_name){
				$type_dropdown.append('<option value="'+mapping_name+'">'+mapping_name+'</option>');
			});
		}
	},
	browse: function() {
		var search_path;
		var index_name = $('#browser_indices').val().substr(6);
		var type_name = $('#browser_types').val();
		if(type_name != '') {
			search_path = type_name;
		}
		var params = {
			size: 25
		};

		bespin.es_request('search', index_name, search_path, params);
	},
	build_browser_results: function(data) {
		// Organise result data
		var headers = ['_index', '_type', '_id'];
		var results = [];
		_.each(data.hits.hits, function(hit){
			var result = {};
			result._index = hit._index;
			result._type = hit._type;
			result._id = hit._id;
			var fields = [];
			_.each(hit._source, function(value, field){
				fields.push(field);
				result[field] = value;
			});
			results.push(result);
			headers = _.union(headers, fields);
		});

		// Display result data
		var $results_table = $('#browser_results');
		$results_table.empty();
		// Header
		var $header_row = $('<tr></tr>');
		_.each(headers, function(header){
			$header_row.append('<th>'+header+'</th>');
		});
		$results_table.append($header_row);
		// Results
		_.each(results, function(result){
			$result_row = $('<tr></tr>');
			_.each(headers, function(field){
				if(_.has(result, field)) {
					var value = result[field];
					if(typeof value == 'string') {
						var truncated = false;
						if(value.length > 50) {
							value = value.substr(0,50);
							value += '...';
							truncated = true;
						}
						value = _.escape(value);
						if(truncated) {
							value += '<div class="expander inline" data-index="'+result._index+'" data-type="'+result._type+'" data-id="'+result._id+'" data-field="'+field+'">...</div>';
						}
					}
					if(typeof value == 'object') {
						if(value != null) {
							value = '<div class="expander" data-index="'+result._index+'" data-type="'+result._type+'" data-id="'+result._id+'" data-field="'+field+'">...</div>';
						}
						else {
							value = 'null';
						}
					}
					$result_row.append('<td>'+value+'</td>');
				}
				else {
					$result_row.append('<td class="empty">[missing]</td>');
				}
			});
			$results_table.append($result_row);
		});
	}
});

$(function(){
	// Initialise the plugin
	bespin.init();
	// Bind events to the various buttons and dropdowns
	$('#connection_button').bind('click', function() {
		var connectionURL = $('#connectionURL').val();
		bespin.connect(connectionURL);
	});
	$('#refresh_button').bind('click', function() {
		bespin.refresh();
	});
	$('#view_type').bind('change', function() {
		var view_type = $(this).val();
		$.cookie("view_type", view_type, { expires:7, path:'/' });
		bespin.view_type = view_type;
		bespin.draw_overview();
	});
	$('.tab').bind('click', function() {
		var content_type = $(this).data('content');
		$(this).addClass('active').siblings().removeClass('active');
		$('#content_'+content_type).addClass('active').siblings().removeClass('active');
	});
	$('#browser_indices').bind('change', function() {
		var browser_index = $(this).val();
		if(browser_index != '') {
			var browser_index_type = browser_index.substr(0,5);
			var browser_index_name = browser_index.substr(6);
			bespin.build_type_browser(browser_index_type, browser_index_name);
			bespin.browse();
		}
	});
	$('#browser_types').bind('change', function() {
		if($('#browser_indices').val() != '') {
			bespin.browse();
		}
	});
});