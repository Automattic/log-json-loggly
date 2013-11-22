
/**
 * Module dependencies.
 */

var fs = require('fs');
var carry = require('carrier').carry;
var request = require('https').request;
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
.option('-r, --retries <num>', 'number of times to retry a http request')
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
debug('max buffer size %d', max);

/**
 * Number of retries (3).
 */

var retries = program.retries || 3;

/**
 * Retry timeout (500ms).
 */

var retryTimeout = 500;

/**
 * Loggly POST url.
 */

var path = '/bulk/' + program.input;

if (program.tag) {
  path += '/tag/' + program.tag + '/';
}

debug('url https://logs-01.loggly.com%s', path);

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

  // buffer.length + newline + json object minus prefix
  // cant exceed 5mb buffer
  var len = buffer.length + (buffer.length ? 1 : 0) + data.length - 7;
  if (len >= max) {
    console.error('WARN: discarding event, max buffer size reached');
    return;
  }

  debug('buffer size %d', len);
  if (buffer.length) buffer += '\n';
  buffer += data.substr(7);
  flush();
}

function flush(){
  if (req) return;
  if (!buffer.length) return debug('nothing to flush');
  debug('sending http request');

  function send(buf, ret){
    req = request({
      method: 'POST',
      hostname: 'logs-01.loggly.com',
      path: path
    }, function(res){
      debug('status %d', res.statusCode);
      if (200 != res.statusCode) {
        var errText = '';
        res.on('data', function(buf){
          errText += buf;
        });
        res.on('end', function(){
          console.error('error %d: %s', err.statusCode, errText);
          errText = null;
          onerr();
        });
      } else {
        debug('%d sent', buf.length);
        req = null;
        buf = null;
        flush();
      }
    });
    req.on('error', function(err){
      console.error(err.stack);
      onerr();
    });
    req.end(buf);

    function onerr(){
      if (ret) {
        retry();
      } else {
        console.error('discarding buffer (size %d)', buf.length);
        buf = null;
        req = null;
        flush();
      }
    }

    function retry(){
      ret--;
      debug('retry %d in %dms', retries - ret, retryTimeout);
      setTimeout(function(){
        send(buf, ret);
      }, retryTimeout);
    }
  }

  send(buffer, retries);
  buffer = '';
}
