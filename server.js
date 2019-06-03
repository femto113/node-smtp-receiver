var SMTPServer = require("./smtpevent.js").SMTPServer;

var smtp = new SMTPServer('localhost');
smtp.listen(1025, "127.0.0.1");
smtp.on('incoming-mail', console.log.bind(console))

const WebSocket = require('ws')

const wss = new WebSocket.Server({ port: 8080 })

wss.on('connection', (conn) => {
  console.log("connection from ", conn._socket.remoteAddress);
  conn.on('message', function (message) {
    console.log(`Received message => ${message} from ${this._socket.remoteAddress}`);
  }.bind(conn));
  conn.incoming = function (remoteAddress, mailfrom, rcpttos, data) {
    console.log("sending mail from", mailfrom, "to", this._socket.remoteAddress);
    conn.send(JSON.stringify({remoteAddress, mailfrom, rcpttos, data}));
  }.bind(conn);
  smtp.on('incoming-mail', conn.incoming)
  conn.on('close', function () {
    console.log("removing incoming-mail listener for", this._socket.remoteAddress);
    smtp.removeListener('incoming-mail', this.incoming);
  }.bind(conn))
  conn.send("connected");
});

