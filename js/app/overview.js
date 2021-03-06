define(["jquery", "lodash", "logger", "signalbus", "core", "templates", "pretty", "browser"], function($, _, logger, signalbus, core, templates, pretty, browser) {
    var overview = {
        view_type: 'vertical',
        init: function() {
            // Get the view type first so when we connect we can render immediately in the correct view
            var cookieViewType = $.cookie('view_type');
            if (cookieViewType !== undefined) {
                $('#view_type').val(cookieViewType);
                this.view_type = cookieViewType;
            }
            // Bind events
            this.bind_events();
            // Set up signals
            var that = this;
            signalbus.listen('refresh', function(){
                that.draw_overview();
            });
            this.draw_overview();
        },
        bind_events: function() {
            var that = this;
            $('#view_type').bind('change', function() {
                var view_type = $(this).val();
                $.cookie("view_type", view_type, { expires:7, path:'/' });
                that.view_type = view_type;
                that.draw_overview();
            });
        },
        draw_overview: function() {
            var that = this;

            logger.debug('Redrawing overview...');

            $('#content_overview').empty();
            $('#content_overview').removeClass('alias_view vertical_view horizontal_view').addClass(this.view_type+'_view');

            switch(this.view_type) {
                case 'alias':
                    _.each(core.alias_keys, function(alias){
                        if(alias != 'NONE') {
                            var data = {
                                name: alias,
                                indices: [],
                                indexTemplate: templates.alias_view.index
                            };
                            var indices = core.aliases[alias].sort();
                            _.each(indices, function(index_name){
                                var index_data = {
                                    index: that.build_index_object(index_name)
                                };
                                data.indices.push(index_data);
                            });
                            var $output = $(templates.alias_view.alias(data));
                            $output.find('div.index').bind('click', function(){
                                that.jump_to_browser($(this).data('name'));
                            });
                            $('#content_overview').append($output)
                        }
                    });
                    _.each(core.alias_keys, function(alias){
                        if(alias == 'NONE') {
                            var indices = core.aliases[alias].sort();

                            _.each(indices, function(index_name){
                                var index_data = {
                                    index: that.build_index_object(index_name)
                                };
                                var $output = $(templates.alias_view.index(index_data));
                                $output.bind('click', function(){
                                    that.jump_to_browser($(this).data('name'));
                                });
                                $('#content_overview').append($output);
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
                    var nodes_to_show = false;
                    $tHeader.append($('<th></th>')); // Empty corner cell
                    _.each(core.nodes, function(node){
                        var output = templates.table_view.node({
                            name: node.name,
                            hostname: node.hostname || node.host
                        });
                        $tHeader.append(output);
                        nodes_to_show = true;
                    });
                    if(core.unassigned_nodes) {
                        var output = templates.table_view.node({
                            name: 'Unassigned',
                            hostname: 'n/a'
                        });
                        $tHeader.append(output);
                        nodes_to_show = true;
                    }
                    if(nodes_to_show) {
                        $output.find('thead').append($tHeader);
                    }

                    // Build content
                    _.each(core.index_keys, function(index_name){
                        var index = core.indices[index_name];
                        var $indexRow = $('<tr></tr>');

                        // Add the index name
                        var $index_output = $(templates.table_view.index({
                            name: index_name,
                            docs: index.docs.num_docs,
                            size: index.index.primary_size || (index.index.primary_size_in_bytes + ' Bytes')
                        }));
                        $index_output.find('span.name').bind('click', function(){
                            that.jump_to_browser($(this).data('name'));
                        });
                        $index_output.find('div.mapping').bind('click', function(){
                            var index_name = $(this).data('name');
                            var data = JSON.stringify(core.indices[index_name].mappings);
                            popup_content = pretty.parse(data, 'json');
                            core.display_popup(popup_content);
                        });
                        $indexRow.append($index_output);

                        // Assigned shards
                        _.each(core.node_keys, function(node){
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
                        if(core.unassigned_nodes) {
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
            var index_data = core.indices[index_name];
            return {
                name: index_name,
                docs: index_data ? index_data.docs.num_docs : 'unknown',
                size: index_data ? index_data.index.primary_size : 'unknown',
            }
        },
        jump_to_browser: function(index_name) {
            core.load_tab('browser');
            browser.switch_to_index(index_name);
        }
    };
    overview.init();
    return overview;
});
