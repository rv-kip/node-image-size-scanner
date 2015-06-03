// Get image sizes for images on a given url
var request         = require('request'),
    async           = require('async'),
    cheerio         = require('cheerio'),
    Filesize        = require('filesize'),
    colors          = require('colors/safe'),
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

NodeImageSizeScanner.prototype.checktest = function(callback) {
    callback("HEY");
};

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
        };

    self.logger.debug("byte_threshold", byte_threshold);

    if (!url) {
        return callback({error: "No url specified"});
    }

    if (!url.match(/http/i) && !url.match(/https/i)) {
        url = "http://" + url;
    }

    request(url, function (err, response, body){
        if (err) {
            self.logger.error(err);
            return callback({"error": err});
        }

        var $ = cheerio.load(body),
            images = $('img').toArray(),
            asyncTasks = [];

        // Process each image
        images.forEach(function(image){
            var image_url = image.attribs.src;
            if (/^\/\//.test(image_url)) {
                image_url = 'http:' + image_url;
            }
            if (!/^https?:\/\//.test(image_url)) {
                image_url = url + image_url;
            }
            asyncTasks.push(function(callback) {
                self.processImage(image_url, byte_threshold, callback);
            });
        });

        // Done
        async.parallel(asyncTasks, function(data){
            self.logger.debug("data2", data);
            json.images.push(data);
            // Sort the output by bytes descending
            json.images.sort(function(a, b){
                return (b.bytes - a.bytes);
            });
            return callback(null, json);
        });

    });
};

// Get the image size json
NodeImageSizeScanner.prototype.processImage = function (image_url, byte_threshold, callback) {
    var self = this;

    self.logger.debug("image_url", image_url);
    self.logger.debug("byte_threshold", byte_threshold);


    request.head(image_url, function(err, res){
        if (err) {
            logger.error(err);
            return {"error": err};
        }

        var data;
        if (res && res.headers['content-length']){
            var file_size_bytes = +(res.headers['content-length']);
            if (!byte_threshold || file_size_bytes > byte_threshold) {
                data = {
                    image_url: image_url,
                    bytes: file_size_bytes
                };
                self.logger.debug("data1", data);
            }
        }
        return callback(data);
    });
};
module.exports = NodeImageSizeScanner;