define(["jquery", "templates"], function($, templates) {
    var logger = {
        level: 'debug',
        debug: function(msg, data) {
            this.display_message('debug', msg, data);
        },
        info: function(msg, data) {
            this.display_message('info', msg, data);
        },
        warn: function(msg, data) {
            this.display_message('warn', msg, data);
        },
        error: function(msg, data) {
            this.display_message('error', msg, data);
        },
        display_message: function(severity, msg, data) {
            var time_now = new Date().toLocaleString();

            var $log_message = $(templates.logger.message({
                severity: severity,
                timestamp: time_now,
                message: msg,
                data: data
            }));
            $log_message.find('.expander').bind('click', function(){
                $(this).next().toggle();
            });

            $('#content_log_messages').prepend($log_message);
            $('#content_log_messages').children(':gt(99)').remove();
        }
    };
    return logger;
});
