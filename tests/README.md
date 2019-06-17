To run the tests, you will need a version of python as the SMTP client uses
the built in one in python's standard library. The tests have all been verified
with python 2.7.

Blackbox tests
--------------

The tests in this section are _"black box"_ tests or, put another way, tests
which test the system as a whole without concerning the code behind the module.

Note: all tests require the test server to be running

	% node test-server.js

To invoke the tests run any of the following;

    * grammar.py:    basic SMTP grammar
    * starttls.py:   ESTMP starttls command
    * concurrent.py: test multiple concurrent threads


Verified Sources
-------------------

Messages successfully received from 

    * outlook.live.com (@hotmail.com address)
        EHLO NAM05-CO1-obe.outbound.protection.outlook.comm
    * mail.google.com (@gmail.com address)
        EHLO mail-ot1-f42.google.com

Online Test Systems
-------------------

These can be useful for testing a deployed server.

Working:

- https://www.checktls.com/TestReceiver
    EHLO www6.CheckTLS.com
- https://mxtoolbox.com/diagnostic.aspx
    EHLO keeper-us-east-1b.mxtoolbox.com
- https://www.gmass.co/smtp-test
- https://www.smtper.net/
- https://pingability.com/smtptest.jsp (Java?)
- http://www.test-smtp.com/
    EHLO www.test-smtp.com
- https://www.dnsqueries.com/en/smtp_test_check.php

Broken:

- https://www.wormly.com/test-smtp-server (PHP?)
    EHLO tools.wormly.com

failed STARTTLS with 

client log 

    Resolving hostname...
    Connecting...
    Connection: opening to smtp.golems.io:25, timeout=300, options=array (
                     )
    Connection: opened
    SERVER -> CLIENT: 220 smtp.golems.io node.js smtpevent server 1.0.0
    CLIENT -> SERVER: EHLO tools.wormly.com
    SERVER -> CLIENT: 250-smtp.golems.io Hello 96.126.113.160
                     250 STARTTLS
    CLIENT -> SERVER: STARTTLS
    SERVER -> CLIENT: 220 Ready to start TLS
    2019-06-15 04:20:42	SMTP Error: Could not connect to SMTP host.
    CLIENT -> SERVER: QUIT
    SERVER -> CLIENT:
    SMTP ERROR: QUIT command failed:
    Connection: closed
    2019-06-15 04:20:42	SMTP connect() failed. https://github.com/PHPMailer/PHPMailer/wiki/Troubleshooting
    Message sending failed.

Server log

    15 Jun 04:20:42 - New SMTP connection from: 96.126.113.160
    15 Jun 04:20:42 - connection wrujuevgzc onVerb "EHLO tools.wormly.com"
    15 Jun 04:20:42 - connection wrujuevgzc onVerb "STARTTLS"
    15 Jun 04:20:42 - starttls: creating TLSSocket...
    15 Jun 04:20:42 - STARTTLS ERROR [Error: 140139015362368:error:14209102:SSL routines:tls_early_post_process_client_hello:unsupported protocol:../deps/openssl/openssl/ssl/statem/statem_srvr.c:1663:
    ] {
      library: 'SSL routines',
      function: 'tls_early_post_process_client_hello',
      reason: 'unsupported protocol',
      code: 'ERR_SSL_UNSUPPORTED_PROTOCOL'
    }
    15 Jun 04:20:42 - STARTTLS ERROR [Error: 140139015362368:error:14209102:SSL routines:tls_early_post_process_client_hello:unsupported protocol:../deps/openssl/openssl/ssl/statem/statem_srvr.c:1663:
    ] {
      library: 'SSL routines',
      function: 'tls_early_post_process_client_hello',
      reason: 'unsupported protocol',
      code: 'ERR_SSL_UNSUPPORTED_PROTOCOL'
    }
    15 Jun 04:20:42 - Connection wrujuevgzc unregistering 96.126.113.160
    15 Jun 04:20:42 - STARTTLS ERROR true
