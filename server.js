var SMTPServer = require("./smtpevent.js").SMTPServer;

var server = new SMTPServer('localhost');
server.listen(1025, "127.0.0.1");
server.on('incoming-mail', console.log.bind(console));

