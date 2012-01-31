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

var net = require('net'),
    util = require('util');
    
function SMTPServer(hostname) {
    net.Server.call(this);
    var that = this;
    util.log('SMTP server started on "'+ hostname + '"');

    this.on('connection', function (socket) {
        new SMTPConnection(hostname, that, socket);
    });
    
    this.version = '0.0.2';
    
};
util.inherits(SMTPServer, net.Server);

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
    
function SMTPConnection(hostname, server, socket) {
    util.log('New SMTP connection from: ' + socket.remoteAddress);

    // Private variables to this instance
    var self = this,
        hostname = hostname || 'localhost',
        greeting = 0,
        mailfrom = null,
        rcpttos = [];
        
    /**
     * Emit a response to the client
     * @param {Number} code
     * @param {String} message
     */
    var respond = function (code, message) { socket.write("" + code + " " + message + SMTPProtocol.EOL); }
    // some sugar for common responses
    respond.Ok = function () { respond(250, "Ok"); }
    respond.Syntax = function (verb) { respond(501, "Syntax: " + verb + (SMTPProtocol.verbs[verb] ? " " + SMTPProtocol.verbs[verb] : "")); };
    
    /**
     * Functions to handle incoming SMTP verbs
     */
    var SMTP = {
        HELO: function (argument) {
            if (greeting) {
                respond(503, 'Duplicate HELO/EHLO');
            } else {
                greeting = argument;
                respond(250, hostname + ' Hello ' + socket.remoteAddress);
            }
            socket.once('data', onVerb);
        },
        NOOP: function () {
            respond.Ok();
            socket.once('data', onVerb);
        },
        QUIT: function () {
            respond(221, hostname + ' closing connection');
            socket.end();
        },
        MAIL: function (argument) {
            var address = get_address('FROM:', argument);
            util.log('===> MAIL ' + argument);
            
            if (!address) {
                respond.Syntax('MAIL');
                return;
            }
            if (mailfrom) {
                respond(503, 'Error: nested MAIL command');
                return;
            }
            mailfrom = address;
            util.log('sender: ' + mailfrom);

            respond.Ok();
            socket.once('data', onVerb);
        },
        RCPT: function (argument) {
            util.log('===> RCPT ' + argument);
            if (!mailfrom) {
                respond(503, 'Error: need MAIL command');
                return;
            }
            address = get_address('TO:', argument);
            if (!address) {
                respond.Syntax('RCPT');
                return;
            }
            rcpttos.push(address);
            util.log('recips: ' + rcpttos.join(', '));
            respond.Ok();
            socket.once('data', onVerb);
        },
        RSET: function () {
            // Reset the sender, recipients, and data, but not the greeting
            mailfrom = null;
            rcpttos = [];
            respond.Ok();
            socket.once('data', onVerb);
        },
        DATA: function () {
            if (!rcpttos.length) {
                respond(503, 'Error: need RCPT command');
                return;
            }
            respond(354, 'End data with <CR><LF>.<CR><LF>');
            socket.once('data', onData);
        }
    }
        
    /**
     * Handle the situation where the client is issuing SMTP commands
     */
    var onVerb = function (buffer) {
        var line = buffer.toString();

        if (!line) {
            respond(500, 'Error: bad syntax');
            return;
        }
        
        // TODO: capture via regex
        var command, argument;
        var first_space_position = line.indexOf(' ');
        if (first_space_position < 0) {
            command = strip(line.toUpperCase());
            argument = null;
        } else {
            command = line.substr(0, first_space_position).toUpperCase();
            argument = strip(line.substr(first_space_position));
        }

        if (!(command in SMTPProtocol.verbs)) {
            socket.once('data', onVerb); //  state = COMMAND;
            respond(502, 'Error: command "' + command + '" not implemented');
            return;
        } else {
          // validate given argument vs expected
          expected = SMTPProtocol.verbs[command];
          if (typeof(expected) != "undefined" && !!expected != !!argument) {
            socket.once('data', onVerb); //  state = COMMAND;
            respond.Syntax(command);
          } else {
            SMTP[command](argument);
          }
        }
    };

   /**
    * Handle the case where the client is transmitting data (i.e. not a command)
    */
    var onData = function (buffer) {
      var line = buffer.toString();

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
      
      server.emit('incoming-mail',
                  socket.remoteAddress, mailfrom, rcpttos,
                  current_data.join(NEWLINE)
                  );
      
      rcpttos = [];
      mailfrom = null;
      respond.Ok();
      socket.once('data', onVerb); //  state = COMMAND;
    }

    // Event listeners:
    socket.on('connect', function () {
        util.log('Socket connected from: ' + socket.remoteAddress + '. Sending welcome message.');
        respond(220, hostname +' node.js smtpevent server ' + server.version);
        socket.once('data', onVerb);
    });
    
    socket.on('close', function () {
        util.log('Socket closed, destroying SMTPConnection instance');
        delete self;
    });
}


// Export public API:
exports.SMTPServer = SMTPServer;

//var server = new SMTPServer('localhost');
//server.listen(1025, "127.0.0.1");
//server.on('incoming-mail', function () {
//   console.log(arguments); 
//});

