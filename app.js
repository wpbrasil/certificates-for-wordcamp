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

// Set static files.
app.use('/static', express.static(__dirname + '/assets'));

// Routes
app.get('/', csrfProtection, function (req, res) {
  var args        = config.site.index;
  args.lang       = config.site.lang;
  args.csrfToken  = req.csrfToken();
  args.formAction = config.routes.certificate;
  args.event      = config.event;

  res.render('index', args);
});

app.post('/' + config.routes.certificate, parseForm, csrfProtection, function (req, res) {
  var templatePath = path.resolve(__dirname, './views/pdf.html');
  var csv          = new findInCSV(path.resolve(__dirname, './' + config.csv));
  var email        = req.body.email;
  var base_url     = req.protocol + '://' + req.get('host');
  var args         = {
    base_url    : base_url,
    certificate : config.certificate,
    event       : config.event
  };

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

    // Set attendee args
    args.attendee = result;

    if ('Yes' !== args.attendee.attendance) {
      res.status(401).send('You did not attended to this WordCamp!');
    }

    fs.readFile(templatePath, function (err, data) {
      if (err) {
        throw err;
      }

      // Style certificate args
      args.certificate.textLine2 = args.certificate.textLine2
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
          "type": "pdf",              // allowed file types: png, jpeg, pdf
          "format": "A4",             // allowed units: A3, A4, A5, Legal, Letter, Tabloid
          "orientation": "landscape", // portrait or landscape
        }
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

app.listen(port, function () {
  console.log('Site running on port ' + port + '!');
});
