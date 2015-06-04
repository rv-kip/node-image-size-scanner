var nock                    = require('nock'),
    request                 = require('request');

var scope = nock('http://www.example.com')
                .get('/page1.html')
                .replyWithFile(200, __dirname + '/nock_replies/page1.html')
                .get('/images/alfa_romeo.jpg')
                .replyWithFile(404, __dirname + '/nock_replies/alfa_romeo.jpg')
;


request.get('http://www.example.com/images/alfa_romeo.jpg', function(err, res, obj) {
    console.log("REMOVE ME", res.statusCode, obj);

});
