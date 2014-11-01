// Get image sizes for images on a given url
var Scraper = require('image-scraper'),
    request = require('request'),
    Filesize = require('filesize'),
    colors = require('colors/safe'),
    sprintf=require("sprintf-js").sprintf;

if (process.argv.length < 3) {
    console.log("Usage: node check URL [min bytes for alert]");
    console.log("Ex: " + colors.grey("node check http://www.google.com 50k"));
    process.exit(1);
}

var test_url = process.argv[2],
    max_size_bytes = process.argv[3] || 0;

if (typeof(max_size_bytes) === "string" && max_size_bytes.match(/k/i)){
    max_size_bytes = max_size_bytes.replace(/k/i, "");
    max_size_bytes = +max_size_bytes * 1000;
}

if (max_size_bytes) {
    console.log(colors.bold("Image files >" + Filesize(max_size_bytes) + " (" + max_size_bytes + " bytes)"));
}

var scraper = new Scraper (test_url);

scraper.on("image", function(image){
    processImage(image);
});

function processImage(image) {
    var image_url = image.address;
    request.head(image_url, function(err, res){
        if (err) {
            return console.error(colors.red("Error"), err);
        }

        if (res && res.headers['content-length']){
            var file_size_bytes = +(res.headers['content-length']),
                file_size = Filesize(file_size_bytes);

            if (file_size_bytes > max_size_bytes) {
                var formatted_file_size = sprintf("%11s", file_size);
                // Images 3x the max size get highlighted in red
                var formatted_output = colors.yellow(formatted_file_size);
                if (file_size_bytes > (3 * max_size_bytes)) {
                    formatted_output = colors.red(formatted_file_size);
                }
                formatted_output += " " + colors.cyan(image_url);
                console.log(formatted_output);
            }
        }
    });
}
scraper.scrape();