#!/usr/bin/env node
// Get image sizes for images on a given url
var request         = require('request'),
    async           = require('async'),
    cheerio         = require('cheerio'),
    Filesize        = require('filesize'),
    colors          = require('colors/safe'),
    sprintf         = require("sprintf-js").sprintf,
    argv            = require('minimist')(process.argv.slice(2));

var usage = "Usage: image_check -u URL [-b MIN_BYTES_TO_ALERT_ON] [-j|-json]\n" +
            "Ex: " + colors.grey("image_check -u http://www.google.com -b 1k");

if (!argv.u) {
    console.log(usage);
    process.exit(1);
}

var url = argv.u,
    max_size_bytes = argv.b || 0,
    json_output = argv.j || argv.json || false,
    formatted_output_arr = {},
    json = {
        url             : url,
        byte_threshold  : max_size_bytes,
        images          : []
    };

if (typeof(max_size_bytes) === "string" && max_size_bytes.match(/k/i)){
    max_size_bytes = max_size_bytes.replace(/k/i, "");
    max_size_bytes = +max_size_bytes * 1000;
}

if (isNaN(max_size_bytes)){
    console.log("Invalid number of bytes: " + max_size_bytes + "\n");
    console.log(usage);
    process.exit(1);
}

if (!url.match(/http/i) && !url.match(/https/i)) {
    url = "http://" + url;
}

request(url, function (err, response, body){
    if (err) {
        console.error(err);
        return;
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
            processImage(image_url, callback);
        });
    });

    // Done
    async.parallel(asyncTasks, function(){
        // Sort the output by bytes descending
        json.images.sort(function(a, b){
            return (b.bytes - a.bytes);
        });

        if (json_output) {
            console.log(json);
        } else {
            if (max_size_bytes) {
                console.log(colors.bold("Image files >" + Filesize(max_size_bytes) + " (" + max_size_bytes + " bytes)"));
            }

            if (json.images.length > 0) {
                json.images.forEach(function(image_data){
                    var image_url = image_data.image_url,
                        file_size_bytes = image_data.bytes,
                        file_size = Filesize(file_size_bytes),
                        formatted_file_size = sprintf("%11s", file_size);

                    // Images 3x the max size get highlighted in red
                    var formatted_output = colors.yellow(formatted_file_size);
                    if (file_size_bytes > (3 * max_size_bytes)) {
                        formatted_output = colors.red(formatted_file_size);
                    }
                    formatted_output += " " + colors.cyan(image_url);

                    console.log(formatted_output);
                });
            } else {
                console.log("No images found at " + url);
            }
        }
    });
});

function processImage(image_url, callback) {
    request.head(image_url, function(err, res){
        if (err) {
            return console.error(colors.red("Error"), err);
        }

        if (res && res.headers['content-length']){
            var file_size_bytes = +(res.headers['content-length']);
            if (file_size_bytes > max_size_bytes) {
                var data = {
                    image_url: image_url,
                    bytes: file_size_bytes
                };
                json.images.push(data);
            }
        }
        callback();
    });
}