define(["jquery", "underscore", "logger", "templates", "cookie"], function($, _, logger, templates) {
	var core = {
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
			this.bind_events();
		},
		bind_events: function() {
			var that = this;
			// Bind events to the various buttons and dropdowns
			$('#connection_button').bind('click', function() {
				var connectionURL = $('#connectionURL').val();
				that.connect(connectionURL);
			});
			$('#refresh_button').bind('click', function() {
				that.refresh();
			});
			$('#view_type').bind('change', function() {
				var view_type = $(this).val();
				$.cookie("view_type", view_type, { expires:7, path:'/' });
				that.view_type = view_type;
				that.draw_overview();
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
					that.build_type_browser(browser_index_type, browser_index_name);
					that.browse();
				}
			});
			$('#browser_types').bind('change', function() {
				if($('#browser_indices').val() != '') {
					that.browse();
				}
			});
			$('#browser_size').bind('change', function() {
				if($('#browser_indices').val() != '') {
					that.browse();
				}
			});
		},
		connect: function(url) {
			logger.info('Connecting to '+url+'...');
			$('#connectionStatus').removeClass().addClass('unknown').text('Connecting...');
			this.status = 'connecting';
			this.server_url = url;
			$.cookie("server_url", url, { expires:7, path:'/' });
			// Refresh all content
			this.refresh();
		},
		refresh: function() {
			// Attempt to get ES status
			this.es_request('status');
			// If we successfully get a good status request all other data and organise/render it
			if(this.status == 'connected') {
				this.es_request('nodes');
				this.es_request('cluster/state');
				this.organize_data();
				this.draw_overview();
				this.build_index_browser();
			}
			else {
				// TODO: Clean up data / displays
			}
		},
		es_request: function(request_name, index_name, additional_path, params) {
			// Build the base request path
			var request_path = this.server_url;
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
			if(accepted_request_names.indexOf(request_name) < 0) {
				logger.warn('Unknown Request!');
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
			logger.debug('Sending ES request: '+request_path);
			var that = this;
			$.ajax({
				async: false,
				url: request_path,
				type: request_type
			}).done(function(data){
				that.process_response(request_name, index_name, data);
			}).fail(function(){
				that.process_response(request_name, index_name, false);
			});
		},
		process_response: function(request_name, index_name, data) {
			// Handle the response from Elastic Search based on the request that was sent
			logger.debug('Processing ES response...');
			switch(request_name) {
				case 'status':
					if(data) {
						// If we successfully get data back from a status request update the UI to show we've
						// established a connection and store some initial data
						logger.info('Connected!');
						this.status = 'connected';
						this.shards.successful = data._shards.successful;
						this.shards.failed = data._shards.failed;
						this.shards.total = data._shards.total;
						this.indices = data.indices;

						var connected_message = 'Connected';
						var connected_status = 'ok';
						connected_message += ' (' + this.shards.successful + ' of ' + this.shards.total + ' shards)';
						// Work out the status highlight colour based off the shard information retrieved
						if(this.shards.total > (this.shards.successful + this.shards.failed)){connected_status = 'warning';}
						if(this.shards.failed > 0){connected_status = 'error';}
						$('#connectionStatus').removeClass().addClass(connected_status).text(connected_message);
					} else {
						logger.error('Connection Error!');
						this.status = 'error';
						$('#connectionStatus').removeClass().addClass('error').text('Connection Error!');
					}
					break;
				case 'nodes':
					if(data) {
						// Node response just goes straight into our local object
						this.nodes = data.nodes;
					}
					else {
						logger.error('Error retrieving nodes!');
					}
					break;
				case 'cluster/state':
					if(data) {
						// Extract alias and mapping information
						var aliases = {'NONE': []};
						var that = this;
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
							that.indices[index_name].mappings = index_obj.mappings;
						});
						this.aliases = aliases;

						// Extract shard information
						_.each(data.routing_table.indices, function(routing, index){
							that.indices[index].shards = routing.shards;
						});
					}
					else {
						logger.error('Error retrieving cluster state!');
					}
					break;
				case 'search':
					if(data) {
						this.build_browser_results(data);
					}
					else {
						logger.error('Error performing search!');
					}
					break;
				default:
					logger.warn('Unknown Response!');
					break;
			}
		},
		organize_data: function() {
			// To facilitate loops we grab and pre-sort the alias, index and node names
			this.alias_keys = Object.keys(this.aliases).sort();
			this.index_keys = Object.keys(this.indices).sort();
			this.node_keys = Object.keys(this.nodes).sort();
			if((this.shards.successful + this.shards.failed) < this.shards.total) {
				this.unassigned_nodes = true;
			}
		},
		draw_overview: function() {
			$('#content_overview').empty();
			$('#content_overview').removeClass('alias_view vertical_view horizontal_view').addClass(this.view_type+'_view');

			var that = this;

			switch(this.view_type) {
				case 'alias':
					_.each(this.alias_keys, function(alias){
						if(alias != 'NONE') {
							var data = {
								name: alias,
								indices: [],
								indexTemplate: templates.alias_view.index
							};
							var indices = that.aliases[alias].sort();
							_.each(indices, function(index_name){
								var index_data = {
									index: that.build_index_object(index_name)
								};
								data.indices.push(index_data);
							});
							var output = templates.alias_view.alias(data);
							$('#content_overview').append(output)
						}
					});
					_.each(this.alias_keys, function(alias){
						if(alias == 'NONE') {
							var indices = that.aliases[alias].sort();

							_.each(indices, function(index_name){
								var index_data = {
									index: that.build_index_object(index_name)
								};
								var output = templates.alias_view.index(index_data);
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
					var $output = $(templates.table_view.table());

					// Pre-form data
					var output_data = {};
					var that = this;

					// Build header
					var $tHeader = $('<tr></tr>');
					$tHeader.append($('<th></th>')); // Empty corner cell
					_.each(this.nodes, function(node){
						var output = templates.table_view.node({
							name: node.name,
							hostname: node.hostname || node.host
						});
						$tHeader.append(output);
						if(that.unassigned_nodes) {
							var output = templates.table_view.node({
								name: 'Unassigned',
								hostname: 'n/a'
							});
							$tHeader.append(output)
						}
					});
					$output.find('thead').append($tHeader);

					// Build content
					_.each(this.index_keys, function(index_name){
						var index = that.indices[index_name];
						var $indexRow = $('<tr></tr>');

						// Add the index name
						var output = templates.table_view.index({
							name: index_name,
							docs: index.docs.num_docs,
							size: index.index.primary_size || (index.index.primary_size_in_bytes + ' Bytes')
						});
						$indexRow.append(output);

						// Assigned shards
						_.each(that.node_keys, function(node){
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
						if(that.unassigned_nodes) {
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
					var output = templates.table_view.table();
					$('#content_overview').append(output);
					break;
			}
		},
		build_index_object: function(index_name) {
			// Builds an object to pass into the underscore template when rendering the alias overview
			var index_data = this.indices[index_name];
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
			var alias_count = this.alias_keys.length;
			if(this.alias_keys.indexOf('NONE') > -1) {
				alias_count -= 1;
			}
			if(alias_count > 0) {
				var $opt_group = $('<optgroup label="Aliases"></optgroup>');
				_.each(this.alias_keys, function(alias_name){
					if(alias_name != 'NONE') {
						$opt_group.append('<option value="alias_'+alias_name+'">'+alias_name+'</option>');
					}
				});
				$index_dropdown.append($opt_group);
			}
			if(this.index_keys.length) {
				var $opt_group = $('<optgroup label="Indices"></optgroup>');
				_.each(this.index_keys, function(index_name){
					$opt_group.append('<option value="index_'+index_name+'">'+index_name+'</option>');
				});
				$index_dropdown.append($opt_group);
			}
		},
		build_type_browser: function(index_type, index_name) {
			var that = this;
			var $type_dropdown = $('#browser_types');
			$type_dropdown.empty();
			$type_dropdown.append('<option value="">--</option>');
			if(index_type == 'alias') {
				_.each(this.aliases[index_name], function(alias_index_name){
					var mappings = that.indices[alias_index_name].mappings;
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
				var mappings = this.indices[index_name].mappings;
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
				size: $('#browser_size').val()
			};

			this.es_request('search', index_name, search_path, params);
		},
		build_browser_results: function(data) {
			// Organise result data
			var headers = [];
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
			// Sort the type specific headers alphabetically
			headers.sort();
			// Add the core headers
			headers = _.union(['_index', '_type', '_id'], headers);

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
			this.populate_filters_dropdown(headers);
		},
		populate_filters_dropdown: function(headers){
			// Populate filters dropdown
			var $filters_dropdown = $('#browser_filters');
			$filters_dropdown.empty();
			$filters_dropdown.append('<option value="">--</option>');
			_.each(headers, function(field){
				$filters_dropdown.append('<option value="'+field+'">'+field+'</option>');
			});
		}
	}
	core.init();
	return core;
});