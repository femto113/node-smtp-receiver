/**
 * Test server for black box tests.
 * @author Euan Goddard
 */

var smtpevent = require('../../smtpevent.js'),
    
server = new smtpevent.SMTPServer('test');

var mailboxes = {
  'me@example.com':     [],
  'you@example.com':    [],
  'bob@example.com':    [],
  'sheila@example.com': [],
  'kurt@example.com':   [],
  'wendy@example.com':  [],
  'tim@example.com':    []
};

server.on('recipient', function (address, next) {
  next(!(address in mailboxes) && 'Mailbox name invalid', address);
});

server.on('incoming-mail', function (peer, from, to, message) {
  to.forEach(function (address) { mailboxes[address].push(message); });

  console.log('Received test message from: '+ peer);
  console.log('Message from: '+ from + ' to: '+ to);
  console.log('---------------------');
  console.log(message.substr(0, 72), message.length > 72 ? "[+" + (message.length - 72) + " more characters]" : "[EOM]");
  console.log('---------------------');
});

server.listen(1025, "127.0.0.1");

// tell server to log its stats every 60 seconds
setInterval(server.log_stats, 60 * 1000);
