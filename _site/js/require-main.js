require.config({
    baseUrl: 'js/app',
    paths: {
    	jquery: '../lib/jquery',
    	underscore: '../lib/underscore',
    	cookie: '../lib/jquery.cookie'
    },
    shim: {
    	'underscore': {
    		exports: '_'
    	},
    	'cookie': ["jquery"]
    }
});

require(['core']);