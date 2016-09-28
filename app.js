'use strict';

var config          = require('config-yml');
var express         = require('express');
var expressPDF      = require('express-pdf');
var fs              = require('fs');
var mustache        = require('mustache');
var mustacheExpress = require('mustache-express');
var path            = require('path');

// Setup app
var app = express();

// Setup Mustache in Express
app.engine('html', mustacheExpress());
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

// Set Express PDF
app.use(expressPDF);

// Routes
app.get('/', function (req, res) {
  res.render('index', {
    title: config.site.title,
    message: config.site.message
  });
});

app.use('/certificate', function (req, res) {
  var templatePath = path.resolve(__dirname, './views/pdf.html');
  var args = {};

  fs.readFile(templatePath, function (err, data) {
    if (err) {
      throw err;
    }

    res.pdfFromHTML({
      filename: 'generated.pdf',
      htmlContent: mustache.render(data.toString(), args)
      // options: {...}
    });
  });
});

app.listen(3000, function () {
  console.log('Site running on port 3000!');
});
