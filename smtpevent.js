/*******************************************************************************
 *
 * Copyright (c) 2011, Euan Goddard <euan.goddard@gmail.com>.
 * All Rights Reserved.
 *
 * This file is part of smtpevent <https://github.com/euangoddard/node-smtpevent>,
 * which is subject to the provisions of the BSD at
 * <https://github.com/euangoddard/node-smtpevent/raw/master/LICENCE>. A copy of
 * the license should accompany this distribution. THIS SOFTWARE IS PROVIDED "AS
 * IS" AND ANY AND ALL EXPRESS OR IMPLIED WARRANTIES ARE DISCLAIMED, INCLUDING,
 * BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF TITLE, MERCHANTABILITY, AGAINST
 * INFRINGEMENT, AND FITNESS FOR A PARTICULAR PURPOSE.
 *
 *******************************************************************************
 */


/**
 * @author Euan Goddard
 * @version 0.0.2
 */

var net = require('net'), events = require('events');
    
function SMTPServer(hostname, opts) {
    net.Server.call(this);

    this.hostname = hostname || require('os').hostname();
    this.name = opts && opts.name || 'node.js smtpevent server';
    this.version = opts && opts.version || '0.0.2';
    this.log = opts && opts.log || require('util').log.bind(this); // TODO: accept as arg

    // connection will call this method when a complete message is received
    // TODO should pass this as arg to connection?
    this.incoming = function (remoteAddress, mailfrom, rcpttos, data) {
      this.emit('incoming-mail', remoteAddress, mailfrom, rcpttos, data);
    }.bind(this);
    // TODO don't we want other hooks? like validating recipients?
   
    this.on('connection', (function (socket) {
        this.log('New SMTP connection from: ' + socket.remoteAddress);
        new SMTPConnection(this, socket);
    }).bind(this));

    this.log('SMTP server started on "'+ this.hostname + '"');
};
require('util').inherits(SMTPServer, net.Server);

var SMTPProtocol = {
  verbs: {
    HELO: 'hostname',
    NOOP: null,
    QUIT: undefined,
    MAIL: 'FROM:<address>',
    RCPT: 'TO: <address>',
    RSET: null,
    DATA: null
  },
  EOL: '\r\n'
};

/**
* Strip extraneous whitespace from the ends of a string
* @param {String} value
* @return {String} value stripped of all whitespace
*/
function strip(value) {
  return value.replace(/^\s+/, '').replace(/\s+$/, '');
};

/**
 * Extract the address ensuring that any <> are correctly removed
 * @param {String} keyword
 * @param {String} argument
 * @return {String} The cleaned address
 */
function get_address(keyword, argument) {
    var address = null, keylen = keyword.length;
        
    if (argument && argument.substr(0, keylen).toUpperCase() === keyword) {
        address = strip(argument.substr(keylen));
        if (address.substr(0, 1) === '<' && address.substr(-1, 1) === '>' && address !== '<>') {
            // Addresses can be in the form <person@dom.com> but watch out
            // for null address, e.g. <>
            address = address.substr(1, (address.length - 2));
        }
    }

    return address;
}
    
function SMTPConnection(serverArg, socketArg) {

    events.EventEmitter.call(this);

    // Private variables to this instance

    this.server = serverArg;
    this.socket = socketArg;

    // state variables
    this.greeting = null;
//    this.envelope = {};
    this.mailfrom = null
    this.rcpttos = []; // TODO move into envelope
    
    // bind the prototype handlers to this instance
    this.SMTP = {};
    for (verb in this.handlers) this.SMTP[verb] = this.handlers[verb].bind(this);
        
    /**
     * Handle the situation where the client is issuing SMTP commands
     */
    this.onVerb = function (buffer) {
        // NOTE: toString should be fast enough for sync op because verb lines are always? short
        var matches = buffer.toString().match(this.reverb);
        if (!matches) return this.respond(500, 'Error: bad syntax');

        var command = matches[1].toUpperCase(), argument = matches[2];
console.log("onVerb", "command", command, "argument", argument);

        // see if this is a command we can handle
        if (!(command in this.SMTP)) return this.respond(502, 'Error: command "' + command + '" not implemented');

        // validate presence of argument if expected, or lack thereof if expected, or ignorability thereof...
        var expected = SMTPProtocol.verbs[command];
        if (typeof(expected) != "undefined" && !!expected != !!argument) return this.respondSyntax(command);

console.log("onVerb", "invoking command");
        return this.SMTP[command](argument);
    }.bind(this);

   /**
    * Handle the case where the client is transmitting data (i.e. not a command)
    */
    this.onData = function (buffer) {
      var line = buffer.toString(); // TODO: seems like this won't work well with big messages that need chunking?

      var current_data = [], NEWLINE = '\n';

      // Ensure that the terminator which appears in the line is removed
      // from the final message:
      line = line.replace(/\r\n\.\r\n$/, '');
      
      // Remove extraneous carriage returns and de-transparency according
      // to RFC 821, Section 4.5.2.
      var lines = line.split('\r\n');
      for (var i=0, text; i<lines.length; i++) {
          text = lines[i];
          if (text && text.substr(0, 1) === '.') {
              current_data.push(text.substr(1));
          } else {
              current_data.push(text);
          }
      }
      
      // called the incoming mail callback
      this.server.incoming(this.socket.remoteAddress, this.mailfrom, this.rcpttos, current_data.join(NEWLINE));
      
      // reset envelope (TODO: is this really correct behavior? shouldn't it get preserved until overwritten or an RSET is sent?)
      this.rcpttos = [];
      this.mailfrom = null;

      this.respondOk();
      this.socket.on('data', this.onVerb); // start listening for verbs again
    }.bind(this);

    // Event listeners:
    this.socket.on('connect', function () {
        this.server.log('Socket connected from: ' + this.socket.remoteAddress + '. Sending welcome message.');
        this.respondWelcome();
        this.socket.on('data', this.onVerb); // start listening for verbs
    }.bind(this));
    
    this.socket.on('close', function () {
        this.server.log('Socket closed, destroying SMTPConnection instance');
        delete this;
    }.bind(this));
}

require('util').inherits(SMTPConnection, events.EventEmitter);


// regex for matching an incoming verb
SMTPConnection.prototype.reverb  = new RegExp("^(?:\s*)([A-Za-z]{4}) ?(.*)(?:\s|\r|\n)*$");

/**
 * Emit a response to the client
 * @param {Number} code
 * @param {String} message
 */
SMTPConnection.prototype.respond = function (code, message) {
console.log("responding", code, message);
    this.socket.write("" + code + " " + message + SMTPProtocol.EOL);
}
// add some sugar for common responses
SMTPConnection.prototype.respondOk = function () { this.respond(250, "Ok"); }
SMTPConnection.prototype.respondSyntax = function (verb) { this.respond(501, "Syntax: " + verb + (SMTPProtocol.verbs[verb] ? " " + SMTPProtocol.verbs[verb] : "")); };
SMTPConnection.prototype.respondWelcome = function () { this.respond(220, [this.server.hostname, this.server.name, this.server.version].join(' ')); };

/**
 * Functions to handle incoming SMTP verbs
 */
SMTPConnection.prototype.handlers = {
    HELO: function (argument) {
        if (this.greeting) {
            this.respond(503, 'Duplicate HELO/EHLO');
        } else {
            this.greeting = argument;
            this.respond(250, this.server.hostname + ' Hello ' + this.socket.remoteAddress);
        }
    },
    NOOP: function () {
        this.respondOk();
    },
    QUIT: function () {
        this.respond(221, this.server.hostname + ' closing connection');
        this.socket.end();
    },
    MAIL: function (argument) {
        this.server.log('===> MAIL ' + argument);
        var address = get_address('FROM:', argument);
        
        if (!address) {
            this.respondSyntax("MAIL");
            return;
        }
        if (this.mailfrom) {
            this.respond(503, 'Error: nested MAIL command');
            return;
        }
        this.mailfrom = address;
        this.server.log('sender: ' + this.mailfrom);

        this.respondOk();
    },
    RCPT: function (argument) {
        this.server.log('===> RCPT ' + argument);
        if (!this.mailfrom) {
            this.respond(503, 'Error: need MAIL command');
            return;
        }
        var address = get_address('TO:', argument);
        if (!address) {
            this.respondSyntax('RCPT');
            return;
        }
        this.rcpttos.push(address);
        this.server.log('recips: ' + this.rcpttos.join(', '));
        this.respondOk();
    },
    RSET: function () {
        // Reset the sender, recipients, and data, but not the greeting
        this.mailfrom = null;
        this.rcpttos = [];
        this.respondOk();
    },
    DATA: function () {
        if (!this.rcpttos.length) {
            this.respond(503, 'Error: need RCPT command');
            return;
        }
        this.respond(354, 'End data with <CR><LF>.<CR><LF>');
        this.socket.removeAllListeners('data'); // stop listening for verbs
        this.socket.once('data', this.onData); // start listening for data
    }
}

// Export public API:
exports.SMTPServer = SMTPServer;

//var server = new SMTPServer('localhost');
//server.listen(1025, "127.0.0.1");
//server.on('incoming-mail', function () {
//   console.log(arguments); 
//});

