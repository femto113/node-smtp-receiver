#!/usr/bin/python
# -*- coding: utf-8 -*-

from smtplib import SMTP
import unittest

class GoodGrammarTests(unittest.TestCase):
    """Collection of tests of valid SMTP grammar (i.e. they should not generate any error responses from server)"""
    
    addrs = [
        'bob@example.com', 'sheila@example.com', 'kurt@example.com',
        'wendy@example.com', 'tim@example.com'
        ]

    def assertOk(self, result):
      self.assertEqual(result, (250, 'Ok'))

    def testConnect(self):
        """On connecting the server sends a 220 response with a welcome message."""

        smtp = SMTP();
        self.assertEqual(smtp.connect('localhost', 1025), (220, 'test node.js smtpevent server 0.0.2'))
        smtp.close()
        
    def testHelo(self):
        """The server responds to a valid HELO command."""

        smtp = SMTP('localhost', 1025)
        self.assertEqual(smtp.helo('example.com'), (250, 'test Hello 127.0.0.1'))
        smtp.close()

    def testNoop(self):
        """The NOOP command takes no arguments."""

        smtp = SMTP('localhost', 1025)
        self.assertOk(smtp.noop())
        smtp.close()
        
    def testQuit(self):
        """The QUIT command works without an argument"""

        smtp = SMTP('localhost', 1025)
        self.assertEqual(smtp.quit(), (221, 'test closing connection'))

    def testQuitWithArgument(self):
        """The QUIT command works with an argument"""
        
        smtp = SMTP('localhost', 1025)
        self.assertEqual(smtp.docmd('QUIT', 'See you later'), (221, 'test closing connection'))
        smtp.close()
        
    def testRset(self):
        """The RSET command takes no arguments."""

        smtp = SMTP('localhost', 1025)
        self.assertOk(smtp.rset())
        smtp.close()
        
    def testMailFrom(self):
        """The MAIL command will extract the email address from the FROM:."""
    
        smtp = SMTP('localhost', 1025)
        self.assertEqual(smtp.mail('person@example.com'), (250, 'Ok'))
        smtp.close()
        
    def testMailFromEmpty(self):
        """The MAIL command handles empty addresses"""
    
        smtp = SMTP('localhost', 1025)
        self.assertEqual(smtp.mail('<>'), (250, 'Ok'))
        smtp.close()
    
    def testMultipleRcpts(self):
        """Multiple RCPT commands can be issued to add recipients."""
        
        smtp = SMTP('localhost', 1025)
        self.assertOk(smtp.docmd('MAIL', 'FROM:<you@example.com>'))
        for rcpt in self.addrs:
            self.assertOk(smtp.docmd('RCPT', 'TO:<%s>' % rcpt))
        smtp.close()
    
    def testDataResponse(self):
        """The DATA instructs the smtp to end the message with <CR><LF>.<CR><LF>."""
        
        smtp = SMTP('localhost', 1025)
        self.assertOk(smtp.mail('you@example.com'))
        self.assertOk(smtp.rcpt('me@example.com'))
        self.assertEqual(smtp.docmd('DATA'), (354, 'End data with <CR><LF>.<CR><LF>'))
        smtp.close()
    
if __name__ == "__main__":
    unittest.main()
