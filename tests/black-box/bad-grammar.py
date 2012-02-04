#!/usr/bin/python
# -*- coding: utf-8 -*-

from smtplib import SMTP
from telnetlib import Telnet
import unittest

class GoodGrammarTests(unittest.TestCase):
    
    addrs = [
        'bob@example.com', 'sheila@example.com', 'kurt@example.com',
        'wendy@example.com', 'tim@example.com'
        ]

    def testWelcomeMessage(self):
        """On connecting the server sends a 220 response with a welcome message."""

        smtp = SMTP();
        self.assertEqual(smtp.connect('localhost', 1025), (220, 'test node.js smtpevent server 0.0.2'));
        smtp.quit()
        
    def testLegalHelo(self):
        """The server responds to a valid HELO command."""

        smtp = SMTP('localhost', 1025)
        self.assertEqual(smtp.helo('example.com'), (250, 'test Hello 127.0.0.1'))
        smtp.quit()

    def testUnimplementedEhlo(self):
        """Unknown commands are ignored and the smtp informed."""

        smtp = SMTP('localhost', 1025)
        self.assertEqual(smtp.ehlo(), (502, 'Error: command "EHLO" not implemented'))
        smtp.quit()
        
    def testIllegalHelo(self):
        """HELO takes a single argument."""

        smtp = SMTP('localhost', 1025)
        self.assertEqual(smtp.docmd('HELO'), (501, 'Syntax: HELO hostname'))
        smtp.quit()
        
    def testMultipleHelo(self):
        """Only a single HELO command is allowed per connection."""

        smtp = SMTP('localhost', 1025)
        smtp.helo()
        self.assertEqual(smtp.helo(), (503, 'Duplicate HELO/EHLO'))
        smtp.quit()
    
    def testIllegalNoop(self):
        """The NOOP command fails if any argument is passed."""

        smtp = SMTP('localhost', 1025)
        response = smtp.docmd('NOOP', 'something else here')
        self.assertEqual(response, (501, 'Syntax: NOOP'))
        smtp.quit()
    
    def testLegalNoop(self):
        """The NOOP command takes no arguments."""

        smtp = SMTP('localhost', 1025)
        response = smtp.noop()
        self.assertEqual(response, (250, 'Ok'))
        smtp.quit()
        
    def testQuit(self):
        """The QUIT command doesn't care about arguments - the connection is quit regardless."""
        
        smtp = SMTP()
        smtp.connect('localhost', 1025)
        response = smtp.docmd('QUIT', 'See you later')
        self.assertEqual(response, (221, 'test closing connection'))
        
        smtp.connect('localhost', 1025)
        response = smtp.docmd('QUIT')
        self.assertEqual(response, (221, 'test closing connection'))
        
    def testLegalRset(self):
        """The RSET command takes no arguments."""

        smtp = SMTP('localhost', 1025)
        self.assertEqual(smtp.rset(), (250, 'Ok'))
        smtp.quit()
        
    def testIllegalRset(self):
        """The RSET command fails if any argument is passed."""

        smtp = SMTP('localhost', 1025)
        response = smtp.docmd('RSET', 'now')
        self.assertEqual(response, (501, 'Syntax: RSET'))
        smtp.quit()
        
    def testMailNoFrom(self):
        """The MAIL command requires FROM: to follow it."""
        
        smtp = SMTP('localhost', 1025)
        self.assertEqual(smtp.docmd('MAIL'), (501, 'Syntax: MAIL FROM:<address>'))
        smtp.quit()
    
    def testMailInvalidFrom(self):
        """The MAIL command requires FROM: to contain an email address."""
        
        smtp = SMTP('localhost', 1025)
        self.assertEqual(smtp.docmd('MAIL FROM:'), (501, 'Syntax: MAIL FROM:<address>'))
        smtp.quit()
    
    def testMailFromParse(self):
        """The MAIL command will extract the email address from the FROM:."""
    
        smtp = SMTP('localhost', 1025)
        self.assertEqual(smtp.docmd('MAIL FROM:<person@example.com>'), (250, 'Ok'))
        smtp.quit()
        
    def testMailFromParse(self):
        """The MAIL command handles empty addresses"""
    
        smtp = SMTP('localhost', 1025)
        self.assertEqual(smtp.docmd('MAIL FROM:<>'), (250, 'Ok'))
        smtp.quit()
    
    def testDuplicateMailCommand(self):
        """Nested MAIL commands are not allowed."""
        
        smtp = SMTP('localhost', 1025)
        self.assertEqual(smtp.docmd('MAIL FROM:<me@example.com>'), (250, 'Ok'))
        self.assertEqual(smtp.docmd('MAIL FROM:<me@example.com>'), (503, 'Error: nested MAIL command'))
        smtp.quit()
        
    def testRcptWithoutMail(self):
        """The RCPT command must be preceded by the MAIL command."""
        
        smtp = SMTP('localhost', 1025)
        smtp.docmd('RCPT TO:<me@example.com>')
        self.assertEqual(response, (503, 'Error: need MAIL command'))
        smtp.quit()
        
    def xtestRcptWithoutTo(self):
        """The RCPT command must contain TO:<address> as the argument."""
        
        smtp = SMTP('localhost', 1025)
        smtp.docmd('MAIL FROM:<you@example.com>')
        self.assertEqual(response, (250, 'Ok')
        smtp.docmd('RCPT')
        self.assertEqual(response, (501, 'Syntax: RCPT TO: <address>')
        smtp.quit()
    
    def xtestRcptEmptyTo(self):
        """The RCPT command cannot have an empty TO:."""
        
        smtp = SMTP('localhost', 1025)
        smtp.docmd('MAIL FROM:<you@example.com>')
        self.assertEqual(response, (250, 'Ok')
        smtp.docmd('RCPT TO:')
        self.assertEqual(response, (501, 'Syntax: RCPT TO: <address>')
        smtp.quit()
        
    def xtestMultipleRcpts(self):
        """Multiple RCPT commands can be issued to add recipients."""
        
        smtp = SMTP('localhost', 1025)
        smtp.docmd('MAIL FROM:<you@example.com>')
        self.assertEqual(response, (250, 'Ok'))
        for rcpt in self.addrs:
            smtp.docmd('RCPT TO:<%s>' % rcpt)
            self.assertEqual(response, (250, 'Ok'))
        smtp.quit()
    
    def xtestDataWithoutRcpt(self):
        """The DATA command must be preceded by the RCPT TO: command."""
        
        smtp = SMTP('localhost', 1025)
        smtp.docmd('DATA')
        self.assertEqual(response, (503, 'Error: need RCPT command'))
        smtp.quit()
    
    def xtestDataResponse(self):
        """The DATA instructs the smtp to end the message with <CR><LF>.<CR><LF>."""
        
        smtp = SMTP('localhost', 1025)
        smtp.docmd('MAIL FROM:<you@example.com>')
        self.assertEqual(response, (250, 'Ok'))
        smtp.docmd('RCPT TO:<me@example.com>')
        self.assertEqual(response, (250, 'Ok'))
        smtp.docmd('DATA')
        self.assertEqual(response,
                         (354, 'End data with <CR><LF>.<CR><LF>')
        smtp.quit()
    
    def testDataIllegalArgument(self):
        """The DATA command does not take any arguments."""
        
        smtp = SMTP('localhost', 1025)
        smtp.docmd('MAIL', 'FROM:<you@example.com>')
        self.assertEqual(response, (250, 'Ok'))
        smtp.docmd('RCPT', 'TO:<me@example.com>')
        self.assertEqual(response, (250, 'Ok'))
        smtp.docmd('DATA', 'some data here')
        self.assertEqual(response, (501, 'Syntax: DATA'))
        smtp.quit()
        
if __name__ == "__main__":
    unittest.main()
