// This is a minimal server example, runs on port 2525 and prints messages to stdout, logs to stderr
var smtp = require(".");

var server = smtp.createServer(
  'smtp.example.com',                   // hostname
  { log: console.error.bind(console) }, // options
  console.log.bind(console)             // "message" event listener
);
server.listen(2525, "127.0.0.1"); // change address to 0.0.0.0 to listen on external interfaces
