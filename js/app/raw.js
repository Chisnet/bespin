define(['jquery'], function($) {
    var raw = {
        init: function() {
            // Set the initial text in the data area
            $('#raw_data').text('{\n    "query": {\n        "match_all": {}\n    }\n}');
        }
    };
    raw.init();
    return raw;
});
