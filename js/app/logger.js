define(["jquery"], function($) {
	var logger = {
		level: 'debug',
		debug: function(msg) {
			this.display_message('debug', msg);
		},
		info: function(msg) {
			this.display_message('info', msg);
		},
		warn: function(msg) {
			this.display_message('warn', msg);
		},
		error: function(msg) {
			this.display_message('error', msg);
		},
		display_message: function(cls, msg) {
			var time_now = new Date().toLocaleString();
			$('#content_log_messages').prepend('<div class='+cls+'><span class="timestamp">['+time_now+']</span> '+msg+'</div>');
			$('#content_log_messages').children(':gt(99)').remove();
		}
	};
	return logger;
});