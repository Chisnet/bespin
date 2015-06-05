define(["lodash"], function(_) {
    var templates = {
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
                    <span class="name" data-name="<%= name %>"><%= name %></span><br/>\
                    <span class="info docs">Documents: <%= docs %></span><br/>\
                    <span class="info size">Size: <%= size %></span>\
                </th>'
            )
        },
        browser: {
            filter: _.template(
                '<div id="filter_<%= field_name %>" class="filter">\
                    <label for="filter_<%= field_name %>_input"><%= field_name %></label>\
                    <input type="text" id="filter_<%= field_name %>_input" data-filter="<%= field_name %>"/>\
                    <button type="button" class="remove_filter" data-filter="<%= field_name %>">-</button>\
                </div>'
            ),
            popup: _.template(
                '<div id="browser_popup">\
                    <div id="browser_popup_close">Close</div>\
                    <div id="browser_popup_content"><%= content %></div>\
                </div>'
            )
        },
        logger: {
            message: _.template(
                '<div class="<%= severity %>">\
                    <span class="timestamp">[<%= timestamp %>]</span> <%= message %>\
                    <% if(typeof(data) !== "undefined") { %>\
                        <div class="expander inline">...</div>\
                        <div class="request_data"><%= data %></div>\
                    <% } %>\
                </div>'
            )
        }
    };
    return templates;
});
