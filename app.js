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
var app  = express();
var port = parseInt(process.env.PORT, 10) || 3000;

// Setup route middlewares
var csrfProtection = csrf({ cookie: true });
var parseForm = bodyParser.urlencoded({ extended: false });

// Setup Mustache in Express
app.engine('html', mustacheExpress());
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

// Set Express PDF
app.use(expressPDF);

// Parse cookies
app.use(cookieParser());

// Set static files.
app.use('/static', express.static(__dirname + '/assets'));

// Routes
app.get('/', csrfProtection, function (req, res) {
  var err         = null;
  var error       = req.query.error;
  var args        = config.site;
  args.event      = config.event;
  args.formAction = config.routes.certificate;
  args.csrfToken  = req.csrfToken();

  if (typeof error !== 'undefined') {
    err = error.replace(/<(?:.|\n|)*?>|\./gm, '');

    if (config.errors[err]) {
      args.error = config.errors[err];
    }
  }
  // Clean any cached error.
  if (null === err) {
    args.error = '';
  }

  res.render('index', args);
});

app.post('/' + config.routes.certificate, parseForm, csrfProtection, function (req, res) {
  var templatePath = path.resolve(__dirname, './views/pdf.html');
  var csv          = new findInCSV(path.resolve(__dirname, './' + config.csv));
  var email        = req.body.email;
  var args         = {
    baseUrl     : req.protocol + '://' + req.get('host'),
    certificate : config.certificate,
    event       : config.event
  };

  // Validate email
  try {
    if ('' === email) {
      throw 'missingEmail';
    }
    if (!isEmail.validate(email)) {
      throw 'invalidEmail';
    }
  } catch(e) {
    res.redirect('/?error=' + e);
  }

  // Find email in CSV
  csv.get({'email': email}, function (result) {
    if (!result) {
      res.redirect('/?error=emailNoExists');
    }

    // Set attendee args
    args.attendee = result;

    if ('Yes' !== args.attendee.attendance) {
      res.redirect('/?error=notAttended');
    }

    fs.readFile(templatePath, function (err, data) {
      if (err) {
        console.log(err);
        res.redirect('/?error=csvError');
      }

      // Style certificate args
      args.attendee.data = args.certificate.textLine2
        .replace('%event_name%', '<strong>' + args.event.name + '</strong>')
        .replace('%event_date%', args.event.date)
        .replace('%attendee_type%', '<strong>' + args.attendee.type.toLowerCase() + '</strong>')
        .replace('%event_duration%', '<strong>' + args.event.duration + '</strong>');

      // Render PDF
      res.pdfFromHTML({
        filename: config.routes.certificate + '.pdf',
        htmlContent: mustache.render(data.toString(), args),
        options: {
          // File options
          'type': 'pdf',              // Allowed file types: png, jpeg, pdf
          'format': 'A4',             // Allowed units: A3, A4, A5, Legal, Letter, Tabloid
          'orientation': 'landscape', // Portrait or landscape
        }
      });
    });
  });
});

// Handle 404
app.use(function (req, res) {
  var args     = config.site;
  args.event   = config.event;
  args.message = config.errors.error404;

  res.status(400);
  res.render('error', args);
});

// Handle CSRF token errors
app.use(function (err, req, res, next) {
  if (err.code !== 'EBADCSRFTOKEN') {
    return next(err);
  }

  var args     = config.site;
  args.event   = config.event;
  args.message = config.errors.csrfError;

  res.status(403);
  res.render('error', args);
});

// Handle 500
app.use(function (err, req, res) {
  var args     = config.site;
  args.event   = config.event;
  args.message = config.errors.error500;

  res.status(500);
  res.render('error', args);
});

app.listen(port, function () {
  console.log('Site running on port ' + port + '!');
});
