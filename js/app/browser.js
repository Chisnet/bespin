define(["jquery", "underscore", "logger", "signalbus", "core", "templates"], function($, _, logger, signalbus, core, templates) {
    var browser = {
        current_filters: [],
        filter_timeout: 0,
        type_intent_delay: 500,

        init: function() {
            // Bind events
            this.bind_events();
            // Set up signalbus
            var that = this;
            signalbus.listen('refresh', function(){
                that.build_index_browser();
            });
            this.build_index_browser();
        },
        bind_events: function() {
            var that = this;

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
            $('#add_filter_button').bind('click', function() {
                var filter_field = $('#browser_filter').val();
                if(that.current_filters.indexOf(filter_field) < 0) {
                    that.current_filters.push(filter_field);
                    var template_data = {
                        field_name: filter_field
                    };
                    var output = templates.browser.filter(template_data);
                    $('#browser_filters').append(output);
                    // Bind an event to the remove button
                    $('#filter_' + filter_field + ' .remove_filter').bind('click', function(){
                        var field_name = $(this).data('filter');
                        that.remove_filter(field_name);
                    });
                    // Bind change event to the field
                    $('#filter_' + filter_field + '_input').bind('change keyup', function() {
                        clearTimeout(that.filter_timeout);
                        that.filter_timeout = setTimeout(function(){
                            that.browse();
                        }, that.type_intent_delay);
                    });
                }
            });
        },
        build_index_browser: function() {
            var $index_dropdown = $('#browser_indices');
            $index_dropdown.empty();
            $index_dropdown.append('<option value="">--</option>');
            var alias_count = core.alias_keys.length;
            if(core.alias_keys.indexOf('NONE') > -1) {
                alias_count -= 1;
            }
            if(alias_count > 0) {
                var $opt_group = $('<optgroup label="Aliases"></optgroup>');
                _.each(core.alias_keys, function(alias_name){
                    if(alias_name != 'NONE') {
                        $opt_group.append('<option value="alias_'+alias_name+'">'+alias_name+'</option>');
                    }
                });
                $index_dropdown.append($opt_group);
            }
            if(core.index_keys.length) {
                var $opt_group = $('<optgroup label="Indices"></optgroup>');
                _.each(core.index_keys, function(index_name){
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
                _.each(core.aliases[index_name], function(alias_index_name){
                    var mappings = core.indices[alias_index_name].mappings;
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
                var mappings = core.indices[index_name].mappings;
                _.each(mappings, function(mapping_data, mapping_name){
                    $type_dropdown.append('<option value="'+mapping_name+'">'+mapping_name+'</option>');
                });
            }
        },
        browse: function() {
            var search_path;
            var index_name = $('#browser_indices').val().substr(6);
            var type_name = $('#browser_types').val();
            var params = {
                size: $('#browser_size').val()
            };

            var search_path = index_name;

            if(type_name != '') {
                search_path += '/' + type_name;
            }
            search_path += '/_search';

            var that = this;
            core.es_request(search_path, params, function(data){
                if(typeof(data) != 'undefined') {
                    that.build_browser_results(data);
                }
                else {
                    logger.error('Error performing search!');
                }
            });
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
            var $filters_dropdown = $('#browser_filter');
            $filters_dropdown.empty();
            $filters_dropdown.append('<option value="">--</option>');
            _.each(headers, function(field){
                $filters_dropdown.append('<option value="'+field+'">'+field+'</option>');
            });
        },
        remove_filter: function(field_name) {
            $('#filter_' + field_name).remove();
            var field_index = this.current_filters.indexOf(field_name);
            if(field_index >= 0) {
                this.current_filters.splice(field_index, 1);
            }
        }
    };
    browser.init();
    return browser;
});