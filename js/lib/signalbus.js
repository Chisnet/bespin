define(function(){var a={signals:{},listeners:function(a){return this.signals[a]||(this.signals[a]={anon:[],named:{}}),this.signals[a]},listen:function(a,b,c){var d=this.listeners(a);c?d.named[c]=b:d.anon.push(b)},dispatch:function(a,b){var c=this.listeners(a);for(var d in c.anon)c.anon[d](b);for(var e in c.named)c.named[e](b)},remove:function(a,b){a?b&&this.signals[a].named[b]?delete this.signals[a].named[b]:this.signals[a]&&delete this.signals[a]:this.signals={}}};return a});