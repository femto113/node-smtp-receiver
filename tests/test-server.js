/**
 * Test server for black box tests.
 * @author Euan Goddard
 */

var fs = require('fs'),
    smtp = require('..');

var options  = {
    key:  fs.readFileSync("privkey.pem"),
    cert: fs.readFileSync("cert.pem")
};

var mailboxes = require('./mailboxes.json');

var server = smtp.createServer('smtp.example.com', options);

server.on('recipient', function (address, next) {
  next(!(address in mailboxes) && 'Mailbox name invalid', address);
});

server.on('message', function (message) {
  message.rcptto.forEach(function (address) { mailboxes[address].push(message); });

  console.log('Received test message from: '+ message.remoteAddress);
  console.log('From: ' + message.mailfrom);
  console.log('  To: ' + message.rcptto.join(', '));
  console.log('---------------------');
  console.log(message.substr(0, 72), message.length > 72 ? "[+" + (message.length - 72) + " more characters]" : "[EOM]");
  console.log('---------------------');
});

// tell server to log its stats every 60 seconds
setInterval(server.log_stats, 60 * 1000);

server.listen(2525, "127.0.0.1");
