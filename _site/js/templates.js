// Bespin
var bespin = window.bespin || {};
$.extend(bespin, {
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
    }
});