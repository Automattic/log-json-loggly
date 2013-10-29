
/**
 * Module dependencies.
 */

var fs = require('fs');
var carry = require('carrier').carry;
var request = require('superagent');
var program = require('commander');
var debug = require('debug')('cloudup:log-reader');

/**
 * Set up commander.
 */

program
.option('-m, --max <events>', 'max number of events to buffer [20000]')
.option('-f, --file <file>', 'file to read events from')
.option('-i, --input <key>', 'loggly input key (required)')
.option('-t, --tag <tag>', 'comma-separated tags to apply')
.parse(process.argv);

/**
 * Require loggly input.
 */

if (!program.input) {
  console.error('\n  Please specify a loggly input with -i/--input.');
  program.outputHelp();
  process.exit(1);
}

/**
 * Loggly POST url.
 */

var url = 'https://logs-01.loggly.com/inputs/' + program.input;

if (program.tag) {
  url += '/tag/' + program.tag + '/';
}

/**
 * Capture stdin if a file is not provided.
 */

var stream;

if (!program.file) {
  process.stdin.resume();
  stream = process.stdin;
} else {
  stream = fs.readFile(program.file);
}

/**
 * Read.
 */

var buffer = '';
var req;

carry(stream, function(data){
  if (buffer.length == program.max) {
    console.error('WARN: discarding event, max buffer size reached');
    return;
  }

  if (!~data.indexOf('Event:')) {
    debug('ignoring line');
    return;
  }

  debug('buffering event');
  if (buffer.length) buffer += ',';
  buffer += data.substr(7);
  flush();
});

function flush(){
  if (req) return;
  if (!buffer.length) return debug('nothing to flush');
  debug('sending http request');
  var n = buffer.length;
  console.log('[' + buffer + ']');
  req = request
  .post(url)
  .type('json')
  .send('[' + buffer + ']')
  .end(function(err, res){
    if (err || res.error) { console.error(res.text); throw err; }
    debug('flushed %d events', n);
    req = null;
    process.nextTick(flush);
  });
  buffer = '';
}
