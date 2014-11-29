require.config({
    baseUrl: 'js/app',
    paths: {
        jquery: '../lib/jquery',
        lodash: '../lib/lodash',
        cookie: '../lib/jquery.cookie',
        signalbus: '../lib/signalbus',
        pretty: '../lib/pretty'
    },
    shim: {
        'cookie': ["jquery"]
    }
});

require([
    'overview',
    'browser'
]);