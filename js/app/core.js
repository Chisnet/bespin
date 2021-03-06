define(["jquery", "lodash", "logger", "signalbus", "pretty", "templates", "cookie"], function($, _, logger, signalbus, pretty, templates) {
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
            else {
                var rootURL = 'http://' + document.location.host + '/';
                $('#connectionURL').val(rootURL);
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
            $('#overview_refresh').bind('click', function() {
                that.refresh();
            });
            $('#browser_refresh').bind('click', function() {
                signalbus.dispatch('browse');
            });
            $('.tab').bind('click', function() {
                var content_type = $(this).data('content');
                that.load_tab(content_type);
            });
        },
        load_tab: function(content_type) {
            $('#tab_'+content_type).addClass('active').siblings().removeClass('active');
            $('#content_'+content_type).addClass('active').siblings().removeClass('active');
            $('#nav_'+content_type).addClass('active').siblings().removeClass('active');
        },
        connect: function(url) {
            // Add a trailing slash if one isn't entered
            if(!/\/$/.test(url)) {
                url = url + '/';
            }
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
            var that = this;
            this.es_get('_status', function(data){
                that.process_status_response(data);
            });

            // If we successfully get a good status request all other data and organise/render it
            if(this.status == 'connected') {
                var that = this;
                this.es_get('_nodes', function(data){
                    if(typeof(data) != 'undefined') {
                        // Node response just goes straight into our local object
                        that.nodes = data.nodes;
                    }
                    else {
                        logger.error('Error retrieving nodes!');
                    }
                });
                this.es_get('_cluster/state', function(data){
                    that.process_cluster_response(data);
                });
                this.organize_data();
                signalbus.dispatch('refresh');
            }
            else {
                // TODO - Actually listen to this somewhere
                signalbus.dispatch('cleanup');
            }
        },
        es_get: function(path, params, callback) {
            // Handle missing args
            if(callback == null) {
                callback = params;
                params = null;
            }
            // Build path
            var request_path = path + '/';
            if(params != null && typeof(params) == 'object') {
                params = $.param(params);
                request_path += '?' + params;
            }
            // Send request
            this.es_request('GET', request_path, null, callback);
        },
        es_post: function(path, data, callback) {
            // Handle missing args
            if(data == null) {
                callback = data;
                data = null;
            }
            // Build path
            var request_path = path + '/';
            // Send request
            this.es_request('POST', request_path, data, callback);
        },
        es_request: function(request_type, request_path, request_data, callback) {
            // Add server URL to the request_path;
            request_path = this.server_url + request_path;
            // Build request
            var ajax_object = {
                async: false,
                url: request_path,
                type: request_type
            };
            if(request_data != null) {
                ajax_object.data = request_data;
                logger.debug('Sending ES request: ' + request_path, pretty.parse(request_data, 'json'));
            }
            else {
                logger.debug('Sending ES request: ' + request_path);
            }
            // Send request
            var that = this;
            $.ajax(ajax_object).done(function(data){
                logger.debug('Request successful, processing response...');
                callback.call(that, data);
            }).fail(function(error){
                logger.error('Request failed!');
                callback.call(that, undefined, error.responseText);
            });
        },
        process_status_response: function(data) {
            if(typeof(data) != 'undefined'){
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
        },
        process_cluster_response: function(data) {
            if(typeof(data) != 'undefined') {
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
                    // Mappings are nice and clean and go straight into our object
                    if(that.indices[index_name]) {
                        that.indices[index_name].mappings = index_obj.mappings;
                    }
                    else {
                        logger.warn('Mappings provided for non-existent index: ' + index_name);
                    }
                });
                this.aliases = aliases;

                // Extract shard information
                _.each(data.routing_table.indices, function(routing, index){
                    if(that.indices[index]) {
                        that.indices[index].shards = routing.shards;
                    }
                    else {
                        logger.warn('Shards provided for non-existent index: ' + index);
                    }
                });
            }
            else {
                logger.error('Error retrieving cluster state!');
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
        display_popup: function(content) {
            if($('#overlay_popup').length) {
                $('#overlay_popup_content').html(content);
                this.update_popup_height();
                $('#overlay_popup').show();
                $('#overlay_popup_content').scrollTop(0);
            }
            else {
                var template_data = {
                    content: content
                };
                var output = templates.core.popup(template_data);
                $('body').append(output);
                this.update_popup_height();
                $('#overlay_popup').show();
                $('#overlay_popup_close').bind('click', function(){
                    $('#overlay_popup').hide();
                });
            }
        },
        update_popup_height: function() {
            if($(window).innerHeight() < 800) {
                $('#overlay_popup_content').addClass('short');
            }
            else {
                $('#overlay_popup_content').removeClass('short');
            }
        }
    }
    core.init();
    return core;
});
