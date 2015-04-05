var wigle = require('./wigle-api');
var _ = require('underscore');

function WigleBatchDownloader(username, password, callback) {
	
	var self = this;
	self.requestTimeout = 1000 * 60; // default
	// self.maxConcurrentRequests = 1;
	self.downloading = false;

	self.wigleClient = wigle.createClient(username, password, callback);
}

// EXAMPLE OPTIONS
// NOTE: FILTER OPTIONS ARE A LIMITED SET OF API PARAMS
// var options = {
// 	chunkSize: "",
// 	fence: {
// 		latrange1: "",
// 		latrange2: "",
// 		longrange1: "",
// 		longrange2: ""
// 	},
// 	filter {
// 		ssid: "",
// 		lastupdt: "",
// 		netid: "",
// 		freenet: "",
// 		paynet: "",
// 		dhcp: "",
// 		onlymine: ""
// 	}
// }
WigleBatchDownloader.prototype.download = function(options, requestCallback, callback){
	
	var self = this;
	var verbose = options.verbose || false;

	self.downloading = true;

	if (options.requestTimeout) self.requestTimeout = options.requestTimeout;

	var chunkObjs = self.getChunkObjects(parseFloat(options.fence.latrange1),
										 parseFloat(options.fence.latrange2),
										 parseFloat(options.fence.longrange1),
										 parseFloat(options.fence.longrange2),
										 parseFloat(options.chunkSize));

	if (verbose) {
		console.log('[verbose] WigleBatchDownloader.download: ' + chunkObjs.length + ' requests prepaired.');
	}

	var numRequests = chunkObjs.length;
	var requestCounter = 0;
	var afterCallback = _.after(numRequests, callback);
	var allNetworks = [];

	// Make only one query at a time so as not to bog down server.
	// recursively calls onQueryChunkReceived() until requestCounter == numRequests
	self._queryChunk(options, chunkObjs[requestCounter], onQueryChunkReceived);

	function onQueryChunkReceived(err, result) {

		if (err) throw err;

		if (verbose) {
			console.log('\n[verbose] WigleBatchDownloader.onQueryChunkReceived: request finished.');
		}

		requestCounter++;
		allNetworks = allNetworks.concat(result.networks);
		requestCallback(result);
		afterCallback(allNetworks);

		// if there are more requests left
		if (requestCounter < numRequests) {
			if (verbose) {
				console.log('[verbose] WigleBatchDownloader.onQueryChunkReceived: More requests left. Waiting ' + self.requestTimeout + 'ms before making another request.');
			}
			setTimeout(function(){
				if (verbose) {
					console.log('[verbose] WigleBatchDownloader.onQueryChunkReceived: timeout finished. Making request.');
				}
				var chunk = chunkObjs[requestCounter];
				if (verbose) {
					var message = '[verbose] WigleBatchDownloader.onQueryChunkReceived: latrange1: ' + chunk.latrange1 + ' latrange2: ' + 
					chunk.latrange2 + ' longrange1: ' + chunk.longrange1 + ' longrange2: ' + chunk.longrange2;
					console.log(message);
				}
				self._queryChunk(options, chunk, onQueryChunkReceived);
			}, self.requestTimeout);
		}
	}
}

WigleBatchDownloader.prototype.getChunkObjects = function(latrange1, latrange2, longrange1, longrange2, chunkSize) {

	var chunkObjs = [];
	// latrange1 must always be less than latrange2 and
	// longrange1 must always be less than longrange2
	for (var x = latrange1; x < latrange2; x += chunkSize) {
		for (var y = longrange1; y < longrange2; y += chunkSize) {
			chunkObjs.push({
				latrange1: parseFloat(x.toFixed(4)),
				latrange2: parseFloat((x + chunkSize).toFixed(4)),
				longrange1: parseFloat(y.toFixed(4)),
				longrange2: parseFloat((y + chunkSize).toFixed(4))
			});
		}
	}

	return chunkObjs;
}

WigleBatchDownloader.prototype._queryChunk = function(options, chunk, callback){

	var self = this;

	if (options.filter) {
		var filter = options.filter;
		if (filter.ssid) chunk.ssid         = filter.ssid;
		if (filter.lastupdt) chunk.lastupdt = filter.lastupdt;
		if (filter.netid) chunk.netid       = filter.netid;
		if (filter.freenet) chunk.freenet   = filter.freenet;
		if (filter.paynet) chunk.paynet     = filter.paynet;
		if (filter.dhcp) chunk.dhcp         = filter.dhcp;
		if (filter.onlymine) chunk.onlymine = filter.onlymine;
	}

	chunk.simple = true;
	
	self.wigleClient.query(chunk, callback);
}

module.exports = WigleBatchDownloader;
