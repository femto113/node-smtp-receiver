/**
 * @author Euan Goddard
 * @version 0.0.1
 */

var net = require('net'),
    sys = require('sys'),
    util = require('util');
    
var SMTPServer = function(hostname) {
    net.Server.call(this);
    var that = this;
    util.log('SMTP server started on "'+ hostname + '"');
    this.on('connection', function (socket) {
        return new SMTPConnection(hostname, that ,socket);
    });
    
};
var SMTPConnection = function (hostname, server, socket) {
    util.log('New SMTP connection from: ' + socket.remoteAddress);

    // Private variables to this instance
    var self = this,
        EOL = '\r\n',
        COMMAND = 0,
        DATA = 1,
        NEWLINE = '\n',
        hostname = hostname || 'localhost',
        state = COMMAND,
        greeting = 0,
        mailfrom = null,
        rcpttos = [];
        
    // Private functions:
    
    /**
     * Strip extraneous whitespace from the ends of a string
     * @param {String} value
     * @return {String} value stripped of all whitespace
     */
    var strip = function(value) {
        return value.replace(/^\s+/, '').replace(/\s+$/, '');
    }
    
    /**
     * Extract the address ensuring that any <> are correctly removed
     * @param {String} keyword
     * @param {String} argument
     * @return {String} The cleaned address
     */
    var get_address = function (keyword, argument) {
        var address = null,
            keylen = keyword.length;
            
        if (!argument) {
            return address;
        }
        
        if (argument.substr(0, keylen).toUpperCase() === keyword) {
            address = strip(argument.substr(keylen));
            if (address.substr(0, 1) === '<' && address.substr(-1, 1) === '>' && address !== '<>') {
                // Addresses can be in the form <person@dom.com> but watch out
                // for null address, e.g. <>
                address = address.substr(1, (address.length - 2));
            }
        }
        return address
    }
    
    /**
     * Functions to handle incoming SMTP commands
     */
    SMTP = {
        HELO: function (argument) {
            if (!argument) {
                self.push('501 Syntax: HELO hostname')
                return;
            }
            if (greeting) {
                self.push('503 Duplicate HELO/EHLO');
            } else {
                greeting = argument;
                self.push('250 ' + hostname + ' Hello ' + socket.remoteAddress);
            }
        },
        NOOP: function (argument) {
            if (argument) {
                self.push('501 Syntax: NOOP');
            } else {
                self.push('250 Ok');
            }
        },
        QUIT: function (argument) {
            // Ignore any argument
            self.push('221 ' + hostname + ' closing connection');
            socket.end();
        },
        MAIL: function (argument) {
            var address = get_address('FROM:', argument);
            util.log('===> MAIL ' + argument);
            
            if (!address) {
                self.push('501 Syntax: MAIL FROM:<address>');
                return;
            }
            if (mailfrom) {
                self.push('503 Error: nested MAIL command');
                return;
            }
            mailfrom = address;
            util.log('sender: ' + mailfrom);

            self.push('250 Ok');
        },
        RCPT: function (argument) {
            util.log('===> RCPT ' + argument);
            if (!mailfrom) {
                self.push('503 Error: need MAIL command');
                return;
            }
            address = get_address('TO:', argument);
            if (!address) {
                self.push('501 Syntax: RCPT TO: <address>');
                return;
            }
            rcpttos.push(address);
            util.log('recips: ' + rcpttos.join(', '));
            self.push('250 Ok');
        },
        RSET: function (argument) {
            if (argument) {
                self.push('501 Syntax: RSET');
                return;
            }
            // Reset the sender, recipients, and data, but not the greeting
            mailfrom = null;
            rcpttos = [];
            state = COMMAND;
            self.push('250 Ok');
        },
        DATA: function (argument) {
            if (!rcpttos.length) {
                self.push('503 Error: need RCPT command');
                return;
            }
            if (argument) {
                self.push('501 Syntax: DATA');
                return;
            }
            
            state = DATA;
            self.push('354 End data with <CR><LF>.<CR><LF>');
        }
    }
        
    // Public functions:
    
    /**
     * Emit a push response to the client
     * @param {String} message
     */
    this.push = function (message) {
        socket.write(message + EOL);
    }
    
    // Event listeners:
    socket.on('connect', function () {
        util.log('Socket connected from: ' + socket.remoteAddress + '. Sending welcome message.');
        self.push('220 ' + hostname +' node.js SMTP server');
    });
    
    socket.on('data', function (buffer) {
        var line = buffer.toString(),
            method = null,
            first_space_position,
            command,
            argument,
            current_data = [],
            lines;
        
        if (state === COMMAND) {
            // Handle the situation where the client is issuing SMTP commands:
            if (!line) {
                self.push('500 Error: bad syntax');
                return;
            }
            
            first_space_position = line.indexOf(' ');
            if (first_space_position < 0) {
                command = strip(line.toUpperCase());
                argument = null;
            } else {
                command = line.substr(0, first_space_position).toUpperCase();
                argument = strip(line.substr(first_space_position));
                
            }

            if (!(command in SMTP)) {
                self.push('502 Error: command "' + command + '" not implemented');
                return;
                
            }
            SMTP[command](argument);
            return;

        }
        else {
            // Handle the case where the client is transmitting data (i.e. not a
            // command)
            if (state !== DATA) {
                self.push('451 Internal confusion');
                return;
            }
            // Remove extraneous carriage returns and de-transparency according
            // to RFC 821, Section 4.5.2.
            lines = line.split('\r\n');
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
            state = COMMAND;
            self.push('250 Ok');
        }
    });
    
    socket.on('close', function () {
        util.log('Socket closed, destroying SMTPConnection instance');
        delete self;
    });
}
    
sys.inherits(SMTPServer, net.Server);


// Export public API:
exports.SMTPServer = SMTPServer;

//var server = new SMTPServer('localhost');
//server.listen(1025, "127.0.0.1");
//server.on('incoming-mail', function () {
//   console.log(arguments); 
//});

