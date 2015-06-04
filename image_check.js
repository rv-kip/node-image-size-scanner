#!/usr/bin/env node
// Get image sizes for images on a given url
var colors                  = require('colors/safe'),
    NodeImageSizeScanner    = require('./index'),
    Filesize                = require('filesize'),
    sprintf                 = require("sprintf-js").sprintf,
    argv                    = require('minimist')(process.argv.slice(2));

var usage = "Usage: image_check -u URL [-b MIN_BYTES_TO_ALERT_ON] [-j|-json]\n" +
            "Ex: " + colors.grey("image_check -u http://www.google.com -b 1k");

if (!argv.u) {
    console.log(usage);
    process.exit(1);
}

var url = argv.u,
    byte_threshold = argv.b || 0,
    json_output = argv.j || argv.json || false,
    formatted_output_arr = {};

if (typeof(byte_threshold) === "string" && byte_threshold.match(/k/i)){
    byte_threshold = byte_threshold.replace(/k/i, "");
    byte_threshold = +byte_threshold * 1000;
}

if (isNaN(byte_threshold)){
    console.log("Invalid number of bytes: " + byte_threshold + "\n");
    console.log(usage);
    process.exit(1);
}

var options = {
    url             : url,
    byte_threshold  : byte_threshold,
    log_level       : "error"
};

var scanner = new NodeImageSizeScanner(options);

function main() {
    runtime_options = {};
    scanner.check(runtime_options)
    .then(function(json) {
        if (!json) {
            console.error("No response");
            process.exit(1);
        }

        if (json_output) {
            console.log(JSON.stringify(json));
        } else {
            if (byte_threshold) {
                console.log(colors.bold("Image files >" + Filesize(byte_threshold) + " (" + byte_threshold + " bytes)"));
            }

            if (json.images.length > 0) {
                json.images.forEach(function(image_data){
                    var image_url = image_data.image_url,
                        file_size_bytes = image_data.bytes || 0,
                        img_error = image_data.error,
                        file_size = Filesize(file_size_bytes),
                        formatted_file_size = sprintf("%11s", file_size);

                    // Images 3x the max size get highlighted in red
                    var formatted_output = colors.yellow(formatted_file_size);
                    if (file_size_bytes > (3 * byte_threshold)) {
                        formatted_output = colors.red(formatted_file_size);
                    }
                    formatted_output += " " + colors.cyan(image_url);

                    if (img_error) {
                        formatted_output += " " + colors.red(img_error);
                    }

                    console.log(formatted_output);
                });
            } else {
                console.log("No images found at " + url);
            }
        }
    })
    .catch (function(err) {
        if (err) {
            console.error(err);
            process.exit(1);
        }
    })
    .done();

}

if (require.main === module)
{
    main();
}