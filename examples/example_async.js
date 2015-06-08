var NodeImageSizeScanner = require('../index');

var options = {
    log_level : 'err' // err, info, debug, off
};

var scanner = new NodeImageSizeScanner(options);

var runtime_options = {
    url                 : 'http://www.nyt.com',
    byte_threshold      : '5k',
    ignore_image_errors : false
};

scanner.checkAsync(runtime_options, function(err, json){
    if (err) {
        return console.error(err);
    }
    console.log(json);
});