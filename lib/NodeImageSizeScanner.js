// Get image sizes for images on a given url
var request         = require('request'),
    async           = require('async'),
    cheerio         = require('cheerio'),
    Filesize        = require('filesize'),
    colors          = require('colors/safe'),
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
    this.logger.level(this.log_level);

    this.byte_threshold = options.byte_threshold || 0;
    this.byte_threshold = this.convertByteThreshold(this.byte_threshold);
    this.log_level = options.log_level || "info"; // Pass in "off" to disable

    if (options.url) {
        this.url = options.url;
    }
}

NodeImageSizeScanner.prototype.check = function(options, callback) {
    if (!options) {
        options = {};
    }

    var self = this,
        byte_threshold = options.byte_threshold || self.byte_threshold || 0,
        url = options.url || self.url || null,
        url_parsed = new URL(url);

    byte_threshold = this.convertByteThreshold(byte_threshold);
    var json = {
            url             : url,
            byte_threshold  : byte_threshold,
            images          : []
    };

    if (!url) {
        return callback({error: "No url specified"});
    }

    if (!url_parsed.protocol.match(/https?:/i)) {
        url = "http://" + url;
    }

    request(url, function (err, response, body){
        self.logger.debug("body", body);
        if (err) {
            self.logger.error(err);
            return callback(err);
        }

        var $ = cheerio.load(body),
            images = $('img').toArray(),
            asyncTasks = [];

        // Process each image
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
                asyncTasks.push(function(callback) {
                    self.processImage(image_url, byte_threshold, callback);
                });
            }
        });

        // Done
        async.parallel(asyncTasks, function(err, image_data_arr){
            if (err) {
                return callback(err);
            }

            // process image_data_arr and filter out images under byte_threshold
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
            return callback(null, json);
        });

    });
};

// Get the image size and build json
NodeImageSizeScanner.prototype.processImage = function (image_url, byte_threshold, callback) {
    var self = this;
    request.head(image_url, function(err, res){
        var data = {
            image_url       : image_url,
            bytes           : -1
        };

        // errors on image request get marked and returned
        // as they could indicate url errors on the page
        if (err) {
            data.error = err;
        }

        if (res){
            if (res.headers['content-length']){
                var file_size_bytes = +(res.headers['content-length']);
                self.logger.debug("file_size_bytes", file_size_bytes);
                data.bytes = file_size_bytes;
            } else {
                // this is a likely 404
                data.error = "Unexpected statusCode: " + res.statusCode || 'unknown';
            }
        } else {
            // something nutty happened
            data.error = data.error || "no response";
        }
        return callback(null, data);
    });
};

// Convert "10k" --> 10000
NodeImageSizeScanner.prototype.convertByteThreshold = function (byte_threshold) {
    this.logger.error('byte_threshold', byte_threshold);
    if (typeof(byte_threshold) === "string" && byte_threshold.match(/k/i)){
        byte_threshold = byte_threshold.replace(/k/i, "");
        byte_threshold = +byte_threshold * 1000;
    }
    this.logger.error('byte_threshold', byte_threshold);
    return byte_threshold;
};
module.exports = NodeImageSizeScanner;