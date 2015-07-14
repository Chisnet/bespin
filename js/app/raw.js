define(['jquery', 'core', 'pretty'], function($, core, pretty) {
    var raw = {
        init: function() {
            // Set the initial text in the data area
            $('#raw_data').text('{\n    "query": {\n        "match_all": {}\n    }\n}');
            // Set the height of the raw browser
            this.update_height();
            // Bind events
            this.bind_events();
        },
        update_height: function() {
            var content_height = $('body').outerHeight() - $('#header').outerHeight() - $('#nav').outerHeight() - 20;
            $('#content_raw').css('height', content_height);
        },
        bind_events: function() {
            var that = this;
            $(window).bind('resize', function(){
                that.update_height();
            });
            $('#raw_request').bind('click', function(){
                that.send_request();
            });
        },
        send_request: function() {
            var that = this;

            var request_method = $('#raw_method').val().toUpperCase();
            var request_path = $('#raw_path').val();
            var request_data = $('#raw_data').val();

            // Clean the request data
            request_data = $('<div>').html(pretty.parse(request_data, 'json')).text();

            core.es_request(request_method, request_path, request_data, function(data, error){
                if(typeof data != 'undefined') {
                    $('#content_raw_right').html(pretty.parse(data, 'json'));
                }
                else {
                    $('#content_raw_right').html(pretty.parse(error, 'json'));
                }
            });
        }
    };
    raw.init();
    return raw;
});
