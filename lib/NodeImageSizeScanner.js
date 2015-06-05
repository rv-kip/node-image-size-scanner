// Get image sizes for images on a given url
var request         = require('request'),
    P               = require('bluebird'),
    nodeify         = require('nodeify'),
    cheerio         = require('cheerio'),
    URL             = require('url-parse'),
    default_logger  = require('./logger');

function NodeImageSizeScanner (options) {
    if (!options) {
        options = {};
    }

    // Loggin'
    if (options.logger) {
        this.logger = options.logger;
    } else {
        this.logger = default_logger;
    }

    // Set log level
    this.log_level = options.log_level || "info"; // Pass in "off" to disable
    this.logger.level(this.log_level);

    this.byte_threshold = options.byte_threshold || 0;
    this.byte_threshold = this.convertByteThreshold(this.byte_threshold);

    // if (typeof options.url === String) {
    if (options.url) {
        this.url = options.url;
    }
}

NodeImageSizeScanner.prototype.check = function(options) {
    if (!options) {
        options = {};
    }

    var self = this,
        deferred = P.defer(),
        byte_threshold = options.byte_threshold || self.byte_threshold || 0,
        url = options.url || self.url || null,
        url_parsed;

    if (!url) {
        // Reject the promise before it's even returned. Then return. Hmm.
        deferred.reject({error: "No url specified"});
        return deferred.promise;
    }

    url_parsed = new URL(url);
    byte_threshold = this.convertByteThreshold(byte_threshold);
    var json = {
            url             : url,
            byte_threshold  : byte_threshold,
            images          : []
    };

    // Add protocol if lacking
    if (!url_parsed.protocol.match(/https?:/i)) {
        url_parsed.protocol = 'http:';
        url = url_parsed.protocol + '//' + url;
    }

    request(url, function (err, response, body){
        if (err) {
            self.logger.error(err);
            return deferred.reject(err);
        }

        var $ = cheerio.load(body),
            images = $('img').toArray(),
            promises = [];

        // Process each image into a promise of image data
        images.forEach(function(image){
            if (image.attribs.src) {
                var image_url = image.attribs.src,
                    image_url_parsed = new URL(image_url);

                // Handle construction of full image_url from possible relative urls on page
                // Ex: '//secure.quantserve.com/pixel/abcdef.gif'
                if (/^\/\//.test(image_url)) {
                    image_url = 'http:' + image_url;
                }
                // Ex: '/base/image.gif'
                if (/^\/\w+/.test(image_url)) {
                    image_url = url_parsed.protocol + '//' + url_parsed.host + image_url_parsed.pathname;
                }

                promises.push(self.processImage(image_url, byte_threshold));
            }
        });

        return P.all(promises)
        .then(function(image_data_arr){
            for (var i = 0; i < image_data_arr.length; i++) {
                var image_obj = image_data_arr[i];

                // Exclude if under byte threshold
                if (byte_threshold && image_obj.bytes !== -1 && image_obj.bytes < byte_threshold) {
                    continue;
                }
                json.images.push(image_obj);
            }

            // Sort the output by bytes descending
            json.images.sort(function(a, b){
                return (b.bytes - a.bytes);
            });
            return deferred.resolve(json);
        })
        .catch(function(err){
            if (err) {
                self.logger.error('async.parallel', err);
                return deferred.reject(err);
            }
        })
        .done();

    });
    return deferred.promise;
};

NodeImageSizeScanner.prototype.checkAsync = function(options, callback) {
    return nodeify(this.check(options), callback);
};

// Get the image size and build json for image
NodeImageSizeScanner.prototype.processImage = function (image_url, byte_threshold) {
    var self = this,
        deferred = P.defer();

    request.head(image_url, function(err, res){
        var data = {
            url             : image_url,
            bytes           : -1 // Start with assumuption of a problem
        };

        // errors on image request get marked and returned
        // as they could indicate url errors on the page
        if (err) {
            data.error = err;
        }

        if (res){
            if (res.headers['content-length']){
                var file_size_bytes = +(res.headers['content-length']);
                data.bytes = file_size_bytes;
            } else {
                // this is a likely 404
                data.error = "Unexpected statusCode: " + res.statusCode || 'unknown';
            }
        } else {
            // something nutty happened
            data.error = data.error || "no response";
        }
        return deferred.resolve(data);
    });
    return deferred.promise;

};

NodeImageSizeScanner.prototype.processImageAsync = function (image_url, byte_threshold) {
    return nodeify(this.processImage(image_url, byte_threshold), callback);
};

// Convert "1k" --> 1024
NodeImageSizeScanner.prototype.convertByteThreshold = function (byte_threshold) {
    if (typeof(byte_threshold) === "string" && byte_threshold.match(/k/i)){
        byte_threshold = byte_threshold.replace(/k/i, "");
        byte_threshold = +byte_threshold * 1024;
    }
    return byte_threshold;
};
module.exports = NodeImageSizeScanner;