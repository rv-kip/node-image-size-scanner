// Get image sizes for images on a given url
var fetch           = require('node-fetch'),
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

    // Don't report images with errors
    // Only report images for which a size could be determined.
    this.ignore_image_errors = options.ignore_image_errors || false;

    // Set byte threshold to report on
    this.byte_threshold = options.byte_threshold || 0;
    this.byte_threshold = this.convertByteThreshold(this.byte_threshold);

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
        ignore_image_errors = options.ignore_image_errors || self.ignore_image_errors || false,
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

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Unexpected status code: ${response.status}`);
            }
            return response.text();
        })
        .then(body => {
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

            return P.all(promises);
        })
        .then(image_data_arr => {
            for (var i = 0; i < image_data_arr.length; i++) {
                var image_obj = image_data_arr[i];

                // ignore images that couldn't be sized...
                // If image size is -1, something went wrong
                if (ignore_image_errors && image_obj.bytes === -1) {
                    continue;
                }

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
        .catch(err => {
            self.logger.error(err);
            return deferred.reject(err);
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

    fetch(image_url, { method: 'HEAD' })
        .then(res => {
            var data = {
                url             : image_url,
                bytes           : -1 // Start with assumption of a problem
            };

            if (res) {
                if (res.headers.get('content-length')) {
                    var file_size_bytes = +(res.headers.get('content-length'));
                    data.bytes = file_size_bytes;
                } else {
                    // this is a likely 404
                    if (res.status !== 200) {
                        data.error = "Unexpected statusCode: " + res.status || 'unknown';
                    } else {
                        data.error = "Unknown Error (" + res.status + ")";
                    }
                    data.statusCode = res.status;
                }
            } else {
                // something nutty happened
                data.error = "no response";
            }
            return deferred.resolve(data);
        })
        .catch(err => {
            var data = {
                url   : image_url,
                bytes : -1,
                error : err.message || "Error fetching image"
            };
            return deferred.resolve(data);
        });

    return deferred.promise;
};

NodeImageSizeScanner.prototype.processImageAsync = function (image_url, byte_threshold, callback) {
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