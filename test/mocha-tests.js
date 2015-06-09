var demand                  = require('must'),
    assert                  = require('assert'),
    NodeImageSizeScanner    = require('../'),
    nock                    = require('nock'),
    fs                      = require('fs'),
    exec                    = require('child_process').exec;

// Set up mock server with an html page, one good image and one 404
var scope = nock('http://www.example.com')
                .get('/page1.html')
                .times(10)
                .replyWithFile(200, __dirname + '/nock_replies/page1.html')
                .intercept('/images/alfa_romeo.jpg', 'HEAD')
                .times(10)
                .reply(200, 'body',{
                    'Content-Length' : getFilesizeInBytes(__dirname + '/nock_replies/alfa_romeo.jpg')
                })
                .intercept('/images/not_found.jpg', 'HEAD')
                .times(10)
                .reply(404)
;

function getFilesizeInBytes(filename) {
     var stats = fs.statSync(filename);
     var fileSizeInBytes = stats.size;
     return fileSizeInBytes;
}

var options = {
    log_level : 'debug'
};

var scanner = new NodeImageSizeScanner(options);

describe("Node Image Size Scanner", function() {
    it("Should be creatable", function(){
        scanner.must.be.an.instanceof(NodeImageSizeScanner);
    });

    it("Should check a (mock) page and find the expected (mock) images (async)", function(finished){
        var runtime_options = {
            url : 'http://www.example.com/page1.html'
        };

        scanner.checkAsync(runtime_options, function(err, json){

            demand(err).be.null();

            json.must.have.property('url');

            json.must.have.property('byte_threshold', scanner.byte_threshold);

            json.must.have.property('images');
            json.images.must.be.an.array();
            json.images.must.have.length(3);

            json.images[0].must.not.have.property('error');
            json.images[0].must.have.property('bytes');
            json.images[0].bytes.must.be.at.least(12000);

            json.images[1].must.have.property('error');
            json.images[1].error.must.contain('404');
            json.images[1].statusCode.must.be(404);
            json.images[1].must.have.property('bytes');
            json.images[1].bytes.must.be(-1);

            json.images[2].must.have.property('error');
            json.images[2].must.have.property('bytes');
            json.images[2].bytes.must.be(-1);

            finished();
        });
    });

    it("Should check a (mock) page and find the expected (mock) images (promises)", function (finished){
        var runtime_options = {
            url : 'http://www.example.com/page1.html'
        };

        scanner.check(runtime_options)
        .then(function(json) {
            json.must.have.property('url');

            json.must.have.property('byte_threshold', scanner.byte_threshold);

            json.must.have.property('images');
            json.images.must.be.an.array();
            json.images.must.have.length(3);

            json.images[0].must.not.have.property('error');
            json.images[0].must.have.property('bytes');
            json.images[0].bytes.must.be.at.least(12000);

            json.images[1].must.have.property('error');
            json.images[1].error.must.contain('404');
            json.images[1].statusCode.must.be(404);
            json.images[1].must.have.property('bytes');
            json.images[1].bytes.must.be(-1);

            json.images[2].must.have.property('error');
            json.images[2].must.have.property('bytes');
            json.images[2].bytes.must.be(-1);

            finished();
        })
        .catch(function(err){
            demand(err).be.null();
        })
        .done();
    });

    it("Should not report on a 404 image if 'ignore_image_errors' is set ", function (finished){
        var runtime_options = {
            url                 : 'http://www.example.com/page1.html',
            ignore_image_errors : true
        };

        scanner.check(runtime_options)
        .then(function(json) {
            json.must.have.property('url');

            json.must.have.property('byte_threshold', scanner.byte_threshold);

            json.must.have.property('images');
            json.images.must.be.an.array();
            json.images.must.have.length(1);

            json.images[0].must.not.have.property('error');
            json.images[0].must.have.property('bytes');
            json.images[0].bytes.must.be.at.least(12000);

            finished();
        })
        .catch(function(err){
            demand(err).be.null();
        })
        .done();
    });

    it("Should not find images under the byte_threshold", function(finished){
        var runtime_options = {
            url             : 'http://www.example.com/page1.html',
            byte_threshold  : 100000
        };

        scanner.checkAsync(runtime_options, function(err, json){

            demand(err).be.null();

            json.must.have.property('url');

            json.must.have.property('byte_threshold', runtime_options.byte_threshold);

            json.must.have.property('images');
            json.images.must.be.an.array();
            json.images.must.have.length(2);

            json.images[0].must.have.property('error');
            json.images[0].error.must.contain('404');
            json.images[0].statusCode.must.be(404);

            finished();
        });
    });


    it("Should convert a byte_threshold of '50k' to an integer equal to 51200", function(finished){
        var options = {
            url             : 'http://www.example.com/page1.html',
            byte_threshold  : '50k'
        };

        var scanner = new NodeImageSizeScanner(options);

        scanner.checkAsync({}, function(err, json){

            demand(err).be.null();
            scanner.byte_threshold.must.be(51200);

            finished();
        });
    });

    it("Command line script should function as module does", function(finished){
        var options = {
            url             : 'http://www.google.com',
        };

        // Define path, escaping spaces if needed
        var path = __dirname + '/../image_check.js';
            command =  path.replace(/ /g, '\\ ') + ' -u ' + options.url + ' -json';

        var child = exec(command, function (error, stdout, stderr) {
            var stdout_obj = JSON.parse(stdout.trim());

            stdout_obj.must.be.an.object();
            stdout_obj.must.have.property('images');
            stdout_obj.images.must.be.an.array();
            finished();
        });
    });
});