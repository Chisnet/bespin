define(["jquery", "lodash", "logger", "signalbus", "core", "templates", "pretty", "typeahead"], function($, _, logger, signalbus, core, templates, pretty) {
    var browser = {
        current_filters: [],
        filter_field_data: {},
        filter_timeout: 0,
        type_intent_delay: 500,
        truncation_point: 50,
        current_page: 1,
        sort_field: '',
        sort_order: 'asc',
        filter_fields: [],

        init: function() {
            // Bind events
            this.bind_events();
            // Set up signalbus
            var that = this;
            signalbus.listen('refresh', function(){
                that.build_index_browser();
            });
            signalbus.listen('browse', function(){
                that.browse();
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
                $('#browser_filter').val('');
                $('#browser_filter_options').hide();
            });
            $('#browser_page_prev').bind('click', function() {
                var page = that.current_page > 1 ? that.current_page-1 : 1;
                that.current_page = page;
                that.browse(page);
            });
            $('#browser_page_next').bind('click', function() {
                var page = that.current_page + 1;
                that.current_page = page;
                that.browse(page);
            });

            $('#browser_filter').typeahead({
                minLength: 1
            },{
                source: browser.field_matcher()
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
                var type_list = [];
                _.each(core.aliases[index_name], function(alias_index_name){
                    var mappings = core.indices[alias_index_name].mappings;
                    _.each(mappings, function(mapping_data, mapping_name){
                        type_list.push(mapping_name);
                    });
                });
                type_list = _.uniq(type_list);
                _.each(type_list, function(mapping_name){
                    $type_dropdown.append('<option value="'+mapping_name+'">'+mapping_name+'</option>');
                });
            }
            else {
                var mappings = core.indices[index_name].mappings;
                _.each(mappings, function(mapping_data, mapping_name){
                    $type_dropdown.append('<option value="'+mapping_name+'">'+mapping_name+'</option>');
                });
            }
        },
        browse: function(page, use_sort) {
            if(typeof(use_sort) == 'undefined'){use_sort=false;}
            if(typeof(page) == 'boolean'){use_sort=page; page=undefined;}
            if(typeof(page) == 'undefined'){page=1; this.current_page=1;}
            if(!use_sort) {
                // Reset the sort
                this.sort_field = '';
                this.sort_order = 'asc';
            }

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

            // Handle pagination
            var from = (page - 1) * result_size;

            // Build filter object (if required)
            var request_body = this.build_filters(result_size, from, use_sort);

            // Make request
            if(request_body) {
                var request_data = JSON.stringify(request_body);
                core.es_post(search_path, request_data, function(data){
                    if(typeof(data) != 'undefined') {
                        that.build_browser_results(data, result_size);
                    }
                    else {
                        logger.error('Error performing search!');
                    }
                });
            }
            else {
                var params = {
                    size: result_size,
                    from: from
                };
                core.es_get(search_path, params, function(data){
                    if(typeof(data) != 'undefined') {
                        that.build_browser_results(data, result_size);
                    }
                    else {
                        logger.error('Error performing search!');
                    }
                });
            }
        },
        build_browser_results: function(data, result_size) {
            var that = this;
            // Organise result data
            var headers = [];
            var results = [];
            var result_count = data.hits.hits.length;
            var total_count = data.hits.total;
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
            var range_start = (this.current_page-1) * result_size + 1;
            var range_end = range_start + result_count - 1;
            $('#browser_results_info').text('Displaying results ' + range_start + ' - ' + range_end + ' of ' + total_count);
            $('#browser_results_nav').show();
            var $results_table = $('#browser_results');
            $results_table.empty().show();
            // Update pagination
            if(this.current_page == 1) {
                $('#browser_page_prev').prop('disabled', true);
            } else {
                $('#browser_page_prev').prop('disabled', false);
            }
            if(total_count <= range_end) {
                $('#browser_page_next').prop('disabled', true);
            } else {
                $('#browser_page_next').prop('disabled', false);
            }

            // Work out and store field data_type
            this.store_field_types(headers);
            // Header
            var $header_row = $('<tr></tr>');
            $header_row.append('<th></th>');
            _.each(headers, function(field_name){
                var field_types = []
                if(that.filter_field_data[field_name]) {
                    field_types = that.filter_field_data[field_name]['types'];
                }
                if(that.is_filterable(field_types)) {
                    var sort_class = '';
                    if(that.sort_field == field_name) {
                        sort_class = ' ' + that.sort_order;
                    }
                    $header_row.append('<th class="sortable' + sort_class + '" data-field="' + field_name + '">' + field_name + '</th>');
                }
                else {
                    $header_row.append('<th>' + field_name + '</th>');
                }
            });
            $results_table.append($header_row);
            // Results
            _.each(results, function(result){
                $result_row = $('<tr></tr>');
                $result_row.append('<td><div class="expander" data-index="'+result._index+'" data-type="'+result._type+'" data-id="'+result._id+'">...</div></td>');
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
            // Update browser interface
            this.filter_fields = headers;
            // Bind expander events
            $('#browser_results .expander').bind('click', function(){
                var result_index = $(this).data('index');
                var result_type = $(this).data('type');
                var result_id = $(this).data('id');
                var result_field = $(this).data('field');

                var document_path = result_index + '/' + result_type + '/' + result_id;

                core.es_get(document_path, function(data){
                    var popup_content;
                    if(result_field) {
                        popup_content = pretty.parse(data._source[result_field], 'json');
                    }
                    else {
                        popup_content = pretty.parse(data, 'json');
                    }
                    core.display_popup(popup_content);
                });
            });
            // Bind sortable events
            $('#browser_results th.sortable').bind('click', function(){
                var sort_field = $(this).data('field');
                if(that.sort_field != sort_field) {
                    that.sort_order = 'asc';
                }
                else {
                    that.sort_order = (that.sort_order == 'asc' ? 'desc' : 'asc');
                }
                that.sort_field = sort_field;
                that.browse(true); // Passing true tells browse to use sorting, otherwise it will reset
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
            this.filter_field_data = {};

            // Look at the mappings to find the types (might vary between indices)
            _.each(fields, function(field) {
                var field_types = [];
                var field_indexing = [];
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
                            if(_.has(property, 'index')) {
                                var field_index = property['index'];
                                field_indexing.push(field_index);
                            }
                        }
                    });
                });
                field_types = _.uniq(field_types);
                field_indexing = _.uniq(field_indexing);
                if(!_.includes(['_index', '_type'], field)) {
                    that.filter_field_data[field] = {
                        'types': field_types,
                        'indexing': field_indexing
                    };
                }
            });
            // Set the default filters types
            this.filter_field_data['_id'] = {
                'types': ['long'],
                'indexing': []
            };
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
        build_filters: function(result_size, from, use_sort) {
            var that = this;
            var valid_filters = 0;
            // Basic query filter structure
            var request_body = {
                size: result_size,
                from: from
            };
            var query_body = {
                bool: {
                    must: []
                }
            };
            // Build up the filters
            if(this.current_filters.length > 0) {
                _.each(this.current_filters, function(filter_name){
                    var filter_value = $('#filter_' + filter_name + '_input').val();
                    if(filter_value != '') {
                        var filter = that.build_filter(filter_name, filter_value);
                        query_body['bool']['must'] = _.union(query_body['bool']['must'], filter);
                        valid_filters += 1;
                    }
                });
            }
            // Add the sort if required
            if(use_sort) {
                var sort_field = that.sort_field;
                var sort_order = that.sort_order;
                if(sort_field == '_id'){sort_field = '_uid';}

                var sort_body = {};
                sort_body[sort_field] = sort_order;
                request_body['sort'] = [sort_body];
            }
            // Only return something if there's at least one valid filter
            if(valid_filters > 0 || use_sort) {
                if(valid_filters > 0) {
                    request_body['query'] = query_body;
                }
                return request_body;
            } else {
                return false;
            }
        },
        build_filter: function(filter_name, filter_value) {
            var filters = [];
            var filter_field_types = [];
            var filter_field_indexing = [];
            if(this.filter_field_data[filter_name]) {
                filter_field_types = this.filter_field_data[filter_name]['types'];
                filter_field_indexing = this.filter_field_data[filter_name]['indexing'];
            }
            // If the only value type is string we can use a wildcard filter, otherwise term will have to do
            if(_.difference(filter_field_types, ['string']).length == 0) {
                var values = _.compact(filter_value.trim().split(' '));
                _.each(values, function(value) {
                    var term = {};
                    if(!_.includes(filter_field_indexing, 'not_analyzed')) {
                        term[filter_name] = '*' + value.toLowerCase() + '*';
                    }
                    else {
                        term[filter_name] = '*' + value + '*';
                    }
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
        switch_to_index: function(index_name) {
            $('#browser_indices').val('index_'+index_name);
            this.browse();
        },
        field_matcher: function() {
            return function(q, cb) {
                var matches = [];
                $.each(browser.filter_fields, function(i, str) {
                    if(str.indexOf(q) === 0 && str != q) {
                        matches.push(str);
                    }
                });
                cb(matches);
            }
        },
    };
    browser.init();
    return browser;
});
