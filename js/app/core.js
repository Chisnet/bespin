define(["jquery", "underscore", "logger", "signalbus", "cookie"], function($, _, logger, signalbus) {
	var core = {
		status: 'disconnected',
		server_url: '',
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
			$('.tab').bind('click', function() {
				var content_type = $(this).data('content');
				$(this).addClass('active').siblings().removeClass('active');
				$('#content_'+content_type).addClass('active').siblings().removeClass('active');
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
				signalbus.dispatch('refresh');
			}
			else {
				// TODO - Actually listen to this somewhere
				signalbus.dispatch('cleanup');
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
						signalbus.dispatch('search_results', data);
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
		}
	}
	core.init();
	return core;
});