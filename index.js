
/**
 * Module dependencies.
 */

var fs = require('fs');
var carry = require('carrier').carry;
var request = require('superagent');
var program = require('commander');
var tail = require('tailfd').tail;
var debug = require('debug')('cloudup:log-reader');

/**
 * Set up commander.
 */

program
.option('-m, --max <max>', 'max buffer size in bytes')
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
 * Max buffer size (5mb).
 */

var max = program.max || 5242880;

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
  debug('read stdin');
  process.stdin.resume();
  carry(process.stdin, online);
} else {
  debug('read file "%s"', program.file);
  tail(program.file, online);
}

/**
 * Read.
 */

var buffer = '';
var req;

function online(data){
  if (!~data.indexOf('Event:')) {
    debug('ignoring line');
    return;
  }

  // buffer.length + comma + json object minus prefix
  // cant exceed 5mb buffer
  var len = buffer.length + 1 + data.length - 7;
  if (len >= max) {
    console.error('WARN: discarding event, max buffer size reached');
    return;
  }

  debug('buffering event (size at %d)', len);
  if (buffer.length) buffer += ',';
  buffer += data.substr(7);
  flush();
}

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
    if (err || res.error) {
      if (res && res.text) console.error(res.statusCode, res.text);
      throw err;
    }
    debug('flushed %d events', n);
    req = null;
    process.nextTick(flush);
  });
  buffer = '';
}
