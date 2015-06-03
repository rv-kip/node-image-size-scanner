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

    if (options.byte_threshold) {
        this.byte_threshold = options.byte_threshold;
    }
    if (options.url) {
        this.url = options.url;
    }

    if (options.logger) {
        this.logger = options.logger;
    } else {
        this.logger = default_logger;
    }

    // Set log level
    if (options.log_level) {
        this.log_level = options.log_level; // Pass in "off" to disable
    } else {
        this.log_level = "info";
    }
    this.logger.level(this.log_level);
}

NodeImageSizeScanner.prototype.check = function(options, callback) {
    if (!options) {
        options = {};
    }

    var self = this,
        byte_threshold = options.byte_threshold || self.byte_threshold || 0,
        url = options.url || self.url || null,
        json = {
            url             : url,
            byte_threshold  : byte_threshold,
            images          : []
        },
        url_parsed = new URL(url);

    if (!url) {
        return callback({error: "No url specified"});
    }

    if (!url_parsed.protocol.match(/https?:/i)) {
        url = "http://" + url;
    }

    request(url, function (err, response, body){
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
            json.images = image_data_arr;

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
            image_url: image_url
        };

        // errors on image request get marked and returned
        // as they could indicate url errors on the page
        if (err) {
            data.error = err;
        }

        if (res && res.headers['content-length']){
            var file_size_bytes = +(res.headers['content-length']);
            if (!byte_threshold || file_size_bytes > byte_threshold) {
                data.bytes = file_size_bytes;
            }
        } else {
            // this is a likely 404
            data.bytes = -1;
            data.error = "Possible missing image";
        }
        return callback(null, data);
    });
};
module.exports = NodeImageSizeScanner;