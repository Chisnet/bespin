define(["jquery", "underscore", "logger", "signalbus", "core", "templates"], function($, _, logger, signalbus, core, templates) {
    var browser = {
        current_filters: [],
        filter_field_types: {},
        filter_timeout: 0,
        type_intent_delay: 500,
        truncation_point: 50,

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
            var that = this;
            var search_path;
            var index_name = $('#browser_indices').val().substr(6);
            var type_name = $('#browser_types').val();
            var result_size = $('#browser_size').val();

            // Build search path
            var search_path = index_name;
            if(type_name != '') {
                search_path += '/' + type_name;
            }
            search_path += '/_search';

            // Build filter object (if required)
            var request_body = this.build_filters(result_size);

            if(request_body) {
                var request_data = JSON.stringify(request_body);
                core.es_post(search_path, request_data, function(data){
                    if(typeof(data) != 'undefined') {
                        that.build_browser_results(data);
                    }
                    else {
                        logger.error('Error performing search!');
                    }
                });
            }
            else {
                var params = {
                    size: result_size
                };
                core.es_get(search_path, params, function(data){
                    if(typeof(data) != 'undefined') {
                        that.build_browser_results(data);
                    }
                    else {
                        logger.error('Error performing search!');
                    }
                });
            }
        },
        build_browser_results: function(data) {
            var that = this;
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
                            if(['_id','_type','_index'].indexOf(field) == -1 && value.length > that.truncation_point) {
                                value = value.substr(0,that.truncation_point);
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
            // Work out and store field data_type
            this.store_field_types(headers);
            // Update browser interface
            this.populate_filters_dropdown(headers);
            // Bind expander events
            $('#browser_results .expander').bind('click', function(){
                var result_index = $(this).data('index');
                var result_type = $(this).data('type');
                var result_id = $(this).data('id');
                var result_field = $(this).data('field');

                var document_path = '/' + result_index + '/' + result_type + '/' + result_id;

                core.es_get(document_path, function(data){
                    logger.info();
                    // Syntax highlighting - http://jsfiddle.net/KJQ9K/670/
                    var popup_content = '<pre>' + JSON.stringify(data._source[result_field], undefined, 4) + '</pre>';
                    that.display_popup(popup_content);
                });
            });
        },
        store_field_types: function(fields){
            var that = this;
            // Gather the data we'll need to look up types
            var index_id = $('#browser_indices').val();
            var index_type = index_id.substr(0,5);
            var index_name = index_id.substr(6);
            var indices = [];
            if(index_type == 'index') {
                indices.push(index_name);
            } else {
                indices = core.aliases[index_name];
            }
            // Clear the current values
            this.filter_field_types = {};
            // Add the default filters types
            this.filter_field_types['_index'] = ['string'];
            this.filter_field_types['_type'] = ['string'];
            this.filter_field_types['_id'] = ['string'];   
            // Look at the mappings to find the types (might vary between indices)
            _.each(fields, function(field) {
                var field_types = [];
                _.each(indices, function(index){
                    var mappings = core.indices[index].mappings;
                    _.each(mappings, function(mapping_data, mapping_name){
                        var properties = mapping_data.properties;
                        if(_.has(properties, field)) {
                            var property = properties[field];
                            if(_.has(property, 'type')) {
                                var field_type = property['type'];
                                if(field_type == 'multi_field') {
                                    field_type = property['fields'][field]['type'];
                                }
                                field_types.push(field_type);
                            }
                        }
                    });
                });
                field_types = _.uniq(field_types);
                that.filter_field_types[field] = field_types;
            });
        },
        populate_filters_dropdown: function(headers){
            var that = this;
            // Populate filters dropdown
            var $filters_dropdown = $('#browser_filter');
            $filters_dropdown.empty();
            $filters_dropdown.append('<option value="">--</option>');

            _.each(headers, function(field_name){
                var field_types = that.filter_field_types[field_name];
                if(that.is_filterable(field_types)) {
                    $filters_dropdown.append('<option value="'+field_name+'">'+field_name+'</option>');
                }
            });
        },
        is_filterable: function(field_types) {
            // Must have at leats one type
            if(field_types.length == 0) {
                return false;
            }
            // Can't be binary or token_count
            if((_.indexOf(field_types, 'binary') > 0) || (_.indexOf(field_types, 'token_count') > 0)) {
                return false;
            }
            // Otherwise it is filterable
            return true;
        },
        remove_filter: function(field_name) {
            $('#filter_' + field_name).remove();
            var field_index = this.current_filters.indexOf(field_name);
            if(field_index >= 0) {
                this.current_filters.splice(field_index, 1);
            }
            this.browse();
        },
        build_filters: function(result_size) {
            var that = this;
            var valid_filters = 0;
            // Basic query filter structure
            var request_body = {
                query: {
                    bool: {
                        must: []
                    }
                },
                size: result_size
            };
            // Build up the filters
            if(this.current_filters.length > 0) {
                _.each(this.current_filters, function(filter_name){
                    var filter_value = $('#filter_' + filter_name + '_input').val().toLowerCase();
                    if(filter_value != '') {
                        var filter = that.build_filter(filter_name, filter_value);
                        request_body['query']['bool']['must'] = _.union(request_body['query']['bool']['must'], filter);
                        valid_filters += 1;
                    }
                });
            }
            // Only return something if there's at least one valid filter
            if(valid_filters > 0) {
                return request_body;
            } else {
                return false;
            }
        },
        build_filter: function(filter_name, filter_value) {
            var filters = [];
            // If the only value type is string we can use a wildcard filter, otherwise term will have to do
            if(_.difference(this.filter_field_types[filter_name], ['string']).length == 0) {
                var values = _.compact(filter_value.trim().split(' '));
                _.each(values, function(value) {
                    var term = {};
                    term[filter_name] = '*' + value + '*';
                    filters.push({wildcard:term});
                });
            }
            else {
                var term = {};
                term[filter_name] = filter_value;
                filters.push({term:term});
            }
            return filters;
        },
        display_popup: function(content) {
            if($('#browser_popup').length) {
                $('#browser_popup_content').html(content);
                $('#browser_popup').show();
            }
            else {
                var template_data = {
                    content: content
                };
                var output = templates.browser.popup(template_data);
                $('body').append(output);
                $('#browser_popup').show();
                $('#browser_popup_close').bind('click', function(){
                    $('#browser_popup').hide();
                });
            }
        }
    };
    browser.init();
    return browser;
});