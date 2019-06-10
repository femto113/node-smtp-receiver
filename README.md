smtp-receiver
=============

Origins
-------

This repository began as a substantially rewritten fork of Euan Goddard's
[node-smtpevent](/euangoddard/node-smtpevent).  Relatively little of the
original code remains untouched, but the spirit of the design, the overall
structure of the project, and many of the test cases originated there.


Motivation
----------

As with the original author I was unsatisfied by any of the existing SMTP servers
for the particular purpose I wanted one for.  Happily I found this one, and set
about rewriting it mostly as an exercise in learning SMTP.  The design goals are 
minimalist:

- sufficiently complete coverage of SMTP to allow *receiving* email (no sending or relaying)
- event oriented (so listeners, not callbacks or promises)
- no dependencies
- low resource requirements (so can run in any context)
- easy to configure and extend


Basic Usage
-----------

Similar to node's `HTTPSever`, you create an `SMTPServer` object and then call its `listen` method
to tell it what port to listen on.  Every time a message is received the server will emit a `message`
event with an `SMTPMessage` object.  This object has just a few properties:

```
remoteAddress // the IP address of the server that gave us the message
mailfrom      // email address of the sender (address part of 'MAIL FROM:<address>')
rcptto        // array of recipient email addresses (address parts of 'RCPT TO: <address>')
data          // body of the message (everything sent after a DATA up to the terminator)

```
Here's a server with a minimal listener that just prints out each message after it is received.
```
const smtp = require("smtp-receiver");

var server = smtp.createServer('smtp.example.com', function (message) {
  console.log(message.remoteAddress, "gave us this message");
  console.log("From: ", message.mailfrom);
  console.log("To: ", message.recptto.join(', '));
  console.log(message.data);
});
server.listen(2525, "127.0.0.1");
```

Advanced Usage: Validating Recipients
-------------------------------------
By default the server will accept any recipient (responding with a `250 Ok`).
If you want to validate recipients (e.g. to reject invalid/non-existant addresses)
you can listen to the `recipient` event.  This listener gets two argument, 
the address, and a `next` callback that follows the standard `(error, data)`
callback pattern.  If a string is passed as `error` the server will
rejecting the recipient with code `553` and the given error string. 
The following example will reject any recipient other than `alice@example.com`
or `bob@example.com`.
```
var mailboxes = {
  'alice@example.com': [],
  'bob@example.com':   [],
}
 
server.on('recipient', function (address, next) {
  next(!(address in mailboxes) && 'Mailbox name invalid', address);
});
```
The `data` argument is what gets added to the `rcpttos`
array in the message, so aliasing/normalizing could be applied as well, e.g.
this could be used to implement Gmail style arbitrary `+` aliases for mailboxes.
```
const regex = /^([^+@]+)(\+[^@]*)?(@.*)$/gm;
server.on('recipient', function (address, next) {
    let m = regex.exec(address)
    next(null, m && m[1] + m[3] || address)
});
// RCPT TO:<alice+example@example.com>
// rcpto == ["alice@example.com"]
```

Advanced Usage: TLS (SSL) Support
---------------------------------
