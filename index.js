/*
 * Copyright (c) 2019, Ken Woodruff <ken.woodruff@gmail.com>.
 * Copyright (c) 2011, Euan Goddard <euan.goddard@gmail.com>.
 * All Rights Reserved.  See LICENSE file for license details.
 */

var net = require('net'),
    events = require('events'),
    util = require('util'),
    tls = require('tls'),
    crypto = require('crypto'),
    pkg = require('./package.json');

var SMTPGrammar = {
  syntax: {
    HELO: 'hostname',
    EHLO: 'hostname',
    NOOP: null,
    QUIT: undefined,
    MAIL: 'FROM:<address>',
    RCPT: 'TO: <address>',
    VRFY: '<address>',
    RSET: null,
    DATA: null
  },
  regex: { 
    // regex for matching any incoming verb
    verb:  /^(?:\s*)([A-Za-z]{4,8}) ?(.*)(?:\s|\r|\n)*$/,
    // regex for matching an incoming email address (as provided in the MAIL FROM: or RCPT TO: commands)
    email: /^\s*(?:FROM:|TO:)?\s*<\s*?([^>]*)\s*>?\s*$/i,
    // regex for matching the end of DATA
    end: /^\.$/
  },
  EOL: '\r\n'
};
    

// TODO: pass the helo/remoteAddress/connection.id in as a received object
// modeled after the Received header? see
// https://www.pobox.com/helpspot/index.php?pg=kb.printer.friendly&id=22
/*
  Received: {
    "from": the name the sending computer gave for itself (the name associated with that computer's IP address [its IP address])
    "by": the receiving computer's name (the software that computer uses) (usually Sendmail, qmail or Postfix)
    "with": protocol (usually SMTP, ESMTP or ESMTPS)
    "id": id assigned by local computer for logging
    ";": timestamp (usually given in the computer's localtime; see below for how you can convert these all to your time)
  }
*/ 
function SMTPMessage(helo, remoteAddress, mailfrom, rcpttos, data) {
    this.helo = helo;
    this.remoteAddress = remoteAddress;
    this.mailfrom = mailfrom;
    this.rcpttos = rcpttos;
    this.data = data;
}

function SMTPServer(hostname, options = {}) {
    net.Server.call(this);

    this.hostname = hostname || require('os').hostname();
    this.name = options && options.name || 'node.js smtpevent server';
    this.version = options && options.version || pkg.version || 'unknown';
    this.log = options && options.log || util.log;

    this.tlsOptions = {
        isServer: true,
        honorCipherOrder: options && "honorCipherOrder" in options ? options.honorCipherOrder : true,
        requestOCSP: options && "requestOCSP" in options ? options.requestOCSP : false,
        key: options.key,
        cert: options.cert 
    }
    // to enable TLS at least a cert and a key must be provided in options
    Object.defineProperty(this, "starttlsEnabled", { get: () => !!this.tlsOptions.key && !!this.tlsOptions.cert });
    if (this.starttlsEnabled) {
      this.tlsOptions.sessionIdContext = crypto.createHash('sha1').update(process.argv.join(' ')).digest('hex').slice(0, 32);
      Object.defineProperty(this, "secureContext", { get: function () {
        return this._secureContext || (this._secureContext = tls.createSecureContext(this.tlsOptions));
      } });
    }

    this.stats = { messages: { total: 0 }, connections: { current: 0, max: 0, total: 0 } };

    this.register = function(connection) {
        this.stats.connections.max = Math.max(++this.stats.connections.current, this.stats.connections.max);
        ++this.stats.connections.total;
    }.bind(this);

    this.unregister = function(connection) {
        this.log('Connection', connection.id, 'unregistering', connection.socket.remoteAddress);
        --this.stats.connections.current;
    }.bind(this);

    this.log_stats = function() { this.log(JSON.stringify(this.stats)); }.bind(this);

    // connection calls this method when a complete message is received
    this.incoming = function (helo, remoteAddress, mailfrom, rcpttos, data) {
        ++this.stats.messages.total;
        this.emit("incoming", new SMTPMessage(helo, remoteAddress, mailfrom, rcpttos, data));
    }.bind(this);

    this.on('connection', (function (socket) {
        this.log('New SMTP connection from: ' + socket.remoteAddress);
        new SMTPConnection(this, socket);
    }).bind(this));

    this.once("listening", (function () {
      this.log('SMTP server listening at ' + this.hostname + ':' + this.address().port);
    }).bind(this));
}
util.inherits(SMTPServer, net.Server);

function createServer(hostname, options, incomingListener) {
    // if options not given incomingListener may be in the wrong spot
    if (typeof incomingListener === "undefined" && typeof options === "function") {
      incomingListener = options;
      options = undefined;
    }

    server = new SMTPServer(hostname, options);

    if (incomingListener) server.on("incoming", incomingListener)

    return server;
}

function SMTPConnection(server, socket) {
    events.EventEmitter.call(this);

    // This id is used for logging, probably should be written to a header in the message
    this.id = (Math.random().toString(36) + "00000").substr(2,10);

    // TODO: do a reverse lookup? seems to be standard practice in SMTP header land
    // dns.reverse(socket.remoteAddress, function (err, hostnames) { ... })

    // TODO: have a "protocol" attribute, default to SMTP, 
    //       set it to ESMTP on ehlo, and ESTMPS on starttls

    this.socket = null; // set below
    this.helo = null;
    this.server = server;
    this.reset(); // initialize envelope and message data

    // add listeners for all of our supported verbs
    for (verb in this.handlers) this.on(verb, this.handlers[verb].bind(this));
        
    // create bound versions of the socket listeners
    this.onVerb = SMTPConnection.prototype.onVerb.bind(this);
    this.onData = SMTPConnection.prototype.onData.bind(this);
    
    this.server.register(this);

    // NOTE: the socket on a connection is mutable because of the possibility of TLS upgrades
    this.setSocket = function (s) {
      if (this.sockets === s) return;
      // remove listeners from old socket (if there was one)
      if (this.socket) {
        this.socket.removeListener('data', this.onVerb);
        this.socket.removeAllListeners('close');
      }
      // reset the helo to allow another HELO/EHLO
      // (see https://tools.ietf.org/html/rfc3207#section-4.2)
      this.helo = null;
      this.socket = s;
      // add listeners to new socket (if there is one)
      if (this.socket) {
        this.socket.on('data', this.onVerb);
        this.socket.on('close', function () {
            this.server.unregister(this);
            delete this;
        }.bind(this));
      }
    }.bind(this);

    this.setSocket(socket);

    this.respondWelcome();
}

util.inherits(SMTPConnection, events.EventEmitter);

SMTPConnection.prototype.starttls = function () {
    if (this.socket instanceof tls.TLSSocket) {
      return this.server.log("starttls: socket is already TLSSocket")
    }

    socketOptions = Object.assign({}, this.server.tlsOptions);
    socketOptions.SNICallback = function (servername, callback) {
        callback(null, this.server.secureContext);
    }.bind(this);

    let returned = false;
    let onError = err => {
        this.server.log("STARTTLS ERROR", err)
        if (returned) return;
        returned = true;
        // TODO: raise an error on the server?
    };

    this.socket.once('error', onError);
      
    // upgrade connection
    this.server.log("starttls: creating TLSSocket...")
    let tlsSocket = new tls.TLSSocket(this.socket, socketOptions);

    const unexpected_events = ['close', 'error', '_tlsError', 'clientError', 'tlsClientError']

    unexpected_events.forEach((e) => tlsSocket.once(e, onError));

    tlsSocket.on('secure', function () {
        this.socket.removeListener('error', onError);
        unexpected_events.forEach((e) => tlsSocket.removeListener(e, onError));
        if (returned) {
            try {
                tlsSocket.end();
            } catch (E) {
                //
            }
            return;
        }
        returned = true;

        this.server.log("starttls: tlsSocket.on('secure') replacing connection socket...")
        this.setSocket(tlsSocket);
        // this.connections.add(connection);
        // connection.on('error', err => this._onError(err));
        // connection.on('connect', data => this._onClientConnect(data));
        // connection.init();
    }.bind(this));
};

SMTPConnection.prototype.reset = function () {
    this.mailfrom = null;
    this.rcpttos = [];
    this.current_data = [];
};

/**
 * Extract the address ensuring that any <> are correctly removed
 * @param {String} argument
 * @return {String} The cleaned address
 */
SMTPConnection.prototype.parse_email_address = function (argument) {
    var m = SMTPGrammar.regex.email.exec(argument)
    return m && m[1];
};

/**
 * Emit a response to the client
 * @param {Number} code
 * @param {String} message
 */
SMTPConnection.prototype.respond = function (code, message) { this.socket.write("" + code + " " + message + SMTPGrammar.EOL); }
// sugar for common responses
SMTPConnection.prototype.respondOk = function () { this.respond(250, "Ok"); }
SMTPConnection.prototype.respondSyntax = function (verb) { this.respond(501, "Syntax: " + verb + (SMTPGrammar.syntax[verb] ? " " + SMTPGrammar.syntax[verb] : "")); };
SMTPConnection.prototype.respondWelcome = function () { this.respond(220, [this.server.hostname, this.server.name, this.server.version].join(' ')); };
// hello message is a standalone because sometimes we need to write it as an extension, other times as a response
SMTPConnection.prototype.helloMessage = function () { return this.server.hostname + ' Hello ' + this.socket.remoteAddress; }
SMTPConnection.prototype.respondHello = function () { this.respond(250, this.helloMessage()); }
// for ESMTP EHLO response
SMTPConnection.prototype.writeExtension = function (code, message) { this.socket.write("" + code + "-" + message + SMTPGrammar.EOL); }


/**
 * Functions to handle incoming SMTP verbs
 */
SMTPConnection.prototype.handlers = {
    HELO: function (argument) {
        if (this.helo) return this.respond(503, 'Duplicate HELO/EHLO');
        this.helo = argument;
        return this.respondHello()
    },
    EHLO: function (argument) {
        if (this.helo) return this.respond(503, 'Duplicate HELO/EHLO');
        this.helo = argument;
        if (this.socket instanceof tls.TLSSocket) {
          // if already secure do not send STARTTLS again
          // TODO: should still write any other extensions
          return this.respondHello()
        } else if (this.server.starttlsEnabled) {
          this.writeExtension(250, this.helloMessage())
          return this.respond(250, "STARTTLS");
        } else {
          return this.respondHello();
        }
    },
    MAIL: function (argument) {
        if (this.mailfrom) return this.respond(503, 'Error: nested MAIL command');
        this.mailfrom = this.parse_email_address(argument);
        if (this.mailfrom == null) return this.respondSyntax("MAIL"); // note that empty string is considered ok
        return this.respondOk();
    },
    RCPT: function (argument) {
        if (this.mailfrom == null) return this.respond(503, 'Error: need MAIL command');
        var address = this.parse_email_address(argument);
        if (!address) return this.respondSyntax('RCPT');
        var next = function (error, data) {
          if (error) return this.respond(553, error);
          this.rcpttos.push(data);
          return this.respondOk();
        }.bind(this);
        // TODO: do this emit async
        if (events.EventEmitter.listenerCount(this.server, 'recipient')) {
          // TODO: add a timeout in case validation takes to long?
          this.server.emit("recipient", address, next);
        } else {
          next(null, address);
        }
    },
    VRFY: function (argument) {
        // NOTE: there are two possible forms of argument, a plain username or a formatted email address
        //       a the moment we're only supporting the address flavor
        if (!argument) return this.respondSyntax('VRFY');
        var address = this.parse_email_address(argument);
        if (!address) return this.respond(504, 'can only verify full addreses');
        // if we do not have a recipient listener always just respond with an "I don't know" message
        if (!events.EventEmitter.listenerCount(this.server, 'recipient')) {
          return this.respond(252, "address might be valid")
        }
        // NOTE: there are two possible forms of argument, a plain username or a formatted email address
        var next = function (error, data) {
          if (error) return this.respond(550, error); // TODO: maybe use 553?
          if (data) return this.respond(250, data);
          return this.respond(252, "address might be valid");
        }.bind(this);
        // TODO: do this emit async
        this.server.emit("recipient", address, next);
    },
    STARTTLS: function () {
      this.respond(220, 'Ready to start TLS');
      return this.starttls();
    },
    DATA: function () {
        if (!this.rcpttos.length) return this.respond(503, 'Error: need RCPT command');
        this.listenForData();
        return this.respond(354, 'End data with <CR><LF>.<CR><LF>');
    },
    QUIT: function () {
        this.respond(221, this.server.hostname + ' closing connection');
        this.socket.end();
    },
    RSET: function () {
        this.reset(); 
        return this.respondOk();
    },
    NOOP: function () {
        this.respondOk();
    }
};

/**
 * Handle the situation where the client is issuing SMTP commands
 */
SMTPConnection.prototype.onVerb = function (buffer) {
    this.server.log("connection", this.id, "onVerb", JSON.stringify(buffer.toString().trim()))
    var matches = buffer.toString().match(SMTPGrammar.regex.verb);
    if (!matches) return this.respond(500, 'Error: bad syntax');

    var command = matches[1].toUpperCase(), argument = matches[2];

    // see if this is a command we can handle
    if (!(command in this.handlers)) return this.respond(502, 'Error: command "' + command + '" not implemented');

    // validate presence of argument if expected, or lack thereof if expected, or ignorability thereof...
    var expected = SMTPGrammar.syntax[command];
    if (typeof(expected) != "undefined" && !!expected != !!argument) return this.respondSyntax(command);

    return this.emit(command, argument);
};

/**
 * Handle the case where the client is transmitting data (i.e. not a command)
 */
SMTPConnection.prototype.onData = function (buffer) {
    this.server.log("connection", this.id, "onData", buffer.toString().trim())
  var lines = buffer.toString().split('\r\n');
  for (var i = 0; i < lines.length; i++) {
      if (lines[i].match(SMTPGrammar.regex.end)) { // we've reached the end of the data
        // hand the completed message off to the server
        this.server.incoming(this.helo, this.socket.remoteAddress, this.mailfrom, this.rcpttos, this.current_data.join('\n'));
        this.reset();
        this.listenForVerbs();
        return this.respondOk();
      } else {
        this.current_data.push(lines[i].replace(/^\./, '')); // remove transparency according to RFC 821, Section 4.5.2
      }
  }
};

SMTPConnection.prototype.listenForVerbs = function () {
  this.socket.removeAllListeners('data');
  this.socket.on('data', this.onVerb);
};

SMTPConnection.prototype.listenForData = function () {
  this.socket.removeAllListeners('data');
  this.socket.on('data', this.onData);
};

// Export public API:
exports.SMTPServer = SMTPServer;
exports.createServer = createServer;
