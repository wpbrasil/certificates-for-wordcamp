'use strict';

var bodyParser      = require('body-parser');
var config          = require('config-yml');
var cookieParser    = require('cookie-parser');
var csrf            = require('csurf');
var express         = require('express');
var expressPDF      = require('express-pdf');
var findInCSV       = require('find-in-csv');
var fs              = require('fs');
var isEmail         = require('isemail');
var mustache        = require('mustache');
var mustacheExpress = require('mustache-express');
var path            = require('path');

// Setup app
var app = express();

// Setup route middlewares
var csrfProtection = csrf({ cookie: true })
var parseForm = bodyParser.urlencoded({ extended: false })

// Setup Mustache in Express
app.engine('html', mustacheExpress());
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

// Set Express PDF
app.use(expressPDF);

// Parse cookies
app.use(cookieParser());

// Routes
app.get('/', csrfProtection, function (req, res) {
  var args        = config.site.index;
  args.lang       = config.site.lang;
  args.csrfToken  = req.csrfToken();
  args.formAction = config.routes.certificate;

  res.render('index', args);
});

app.post('/' + config.routes.certificate, parseForm, csrfProtection, function (req, res) {
  var templatePath = path.resolve(__dirname, './views/pdf.html');
  var csv          = new findInCSV(path.resolve(__dirname, './' + config.csv));
  var email        = req.body.email;
  var args         = {};

  // Validate email
  if ('' === email) {
    res.status(401).send('Missing email address!');
  }
  if (!isEmail.validate(email)) {
    res.status(401).send('Invalid email address!');
  }

  csv.get({'email': email}, function (result) {
    if (!result) {
      res.status(404).send('The email address does not exists!');
    }

    args.attendee = result;

    fs.readFile(templatePath, function (err, data) {
      if (err) {
        throw err;
      }

      res.pdfFromHTML({
        filename: config.routes.certificate + '.pdf',
        htmlContent: mustache.render(data.toString(), args)
        // options: {...}
      });
    });
  });
});

app.use(function (err, req, res, next) {
  if (err.code !== 'EBADCSRFTOKEN') {
    return next(err);
  }

  // Handle CSRF token errors here
  res.status(403);
  res.send('ERROR MESSAGE HERE');
})

app.listen(3000, function () {
  console.log('Site running on port 3000!');
});
