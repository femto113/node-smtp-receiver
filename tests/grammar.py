#!/usr/bin/python
# -*- coding: utf-8 -*-

import json
from smtplib import SMTP
import unittest

PORT = 2525
    
class GoodGrammarTests(unittest.TestCase):
    """Collection of tests of valid SMTP grammar (i.e. they should not generate any error responses from server)"""

    def setUp(self):
        self.smtp = SMTP('localhost', PORT)
        with open('mailboxes.json', 'r') as f:
            self.mailboxes = json.load(f)
        # Turning this on will echo the full conversation, useful for debugging
        # self.smtp.set_debuglevel(True)

    def tearDown(self):
        self.smtp.close()
        self.smtp = None

    def assertOk(self, result):
      self.assertEqual(result[0], 250)

    def testConnect(self):
        """On connecting the server sends a 220 response with a welcome message."""
        smtp = SMTP();
        code, text = smtp.connect('localhost', PORT)
        self.assertEqual(code, 220)
        # TODO: any assertion to be made about text?
        smtp.quit();
        smtp.close()
        
    def testHelo(self):
        """The server responds to a valid HELO command."""
        self.assertEqual(self.smtp.helo('example.com'), (250, 'smtp.example.com Hello 127.0.0.1'))

    def testNoop(self):
        """The NOOP command takes no arguments."""
        self.assertOk(self.smtp.noop())
        
    def testQuit(self):
        """The QUIT command works without an argument"""
        self.assertEqual(self.smtp.quit(), (221, 'smtp.example.com closing connection'))

    def testQuitWithArgument(self):
        """The QUIT command works with an argument"""
        self.assertEqual(self.smtp.docmd('QUIT', 'See you later'), (221, 'smtp.example.com closing connection'))
        
    def testRset(self):
        """The RSET command takes no arguments."""
        self.assertOk(self.smtp.rset())

    def testVrfyGoodAddress(self):
        """VRFY with a good address should return a 250 and the address"""
        for rcpt in self.mailboxes:
            code, text = self.smtp.docmd('VRFY', '<%s>' % rcpt)
            self.assertEqual(code, 250)
            self.assertIn(rcpt, text)

    def testVrfyBadAddress(self):
        """VRFY with a bad address should return a 550"""
        rcpt = 'bad@example.com'
        assert rcpt not in self.mailboxes, "the known bad address isn't"
        self.assertEqual(self.smtp.docmd('VRFY', '<%s>' % rcpt), (550, 'Mailbox name invalid'))
        
    def testMailFrom(self):
        """The MAIL command will extract the email address from the FROM:."""
        self.assertEqual(self.smtp.mail('person@example.com'), (250, 'Ok'))
        
    def testMailFromEmpty(self):
        """The MAIL command handles empty addresses"""
        self.assertEqual(self.smtp.mail('<>'), (250, 'Ok'))
    
    def testMultipleRcpts(self):
        """Multiple RCPT commands can be issued to add recipients."""
        self.assertOk(self.smtp.docmd('MAIL', 'FROM:<you@example.com>'))
        for rcpt in self.mailboxes:
            self.assertOk(self.smtp.docmd('RCPT', 'TO:<%s>' % rcpt))
    
    def testDataResponse(self):
        """The DATA instructs the self.smtp to end the message with <CR><LF>.<CR><LF>."""
        self.assertOk(self.smtp.mail('you@example.com'))
        self.assertOk(self.smtp.rcpt('me@example.com'))
        self.assertEqual(self.smtp.docmd('DATA'), (354, 'End data with <CR><LF>.<CR><LF>'))

class BadGrammarTests(unittest.TestCase):
    """Collection of tests of invalid SMTP grammar (most should produce 5XX error codes)"""
    
    def setUp(self):
        self.smtp = SMTP('localhost', PORT)
        # self.smtp.set_debuglevel(True)

    def tearDown(self):
        self.smtp.close()
        self.smtp = None
  
    def testIllegalHelo(self):
        """HELO takes a single argument."""
        self.assertEqual(self.smtp.docmd('HELO'), (501, 'Syntax: HELO hostname'))
        
    def testMultipleHelo(self):
        """Only a single HELO command is allowed per connection."""
        self.smtp.helo()
        self.assertEqual(self.smtp.helo(), (503, 'Duplicate HELO/EHLO'))
    
    def testIllegalNoop(self):
        """The NOOP command fails if any argument is passed."""
        response = self.smtp.docmd('NOOP', 'something else here')
        self.assertEqual(response, (501, 'Syntax: NOOP'))
        
    def testIllegalRset(self):
        """The RSET command fails if any argument is passed."""
        response = self.smtp.docmd('RSET', 'now')
        self.assertEqual(response, (501, 'Syntax: RSET'))
        
    def testMailNoFrom(self):
        """The MAIL command requires FROM: to follow it."""
        self.assertEqual(self.smtp.docmd('MAIL'), (501, 'Syntax: MAIL FROM:<address>'))
    
    def testMailInvalidFrom(self):
        """The MAIL command requires FROM: to contain an email address."""
        self.assertEqual(self.smtp.docmd('MAIL FROM:'), (501, 'Syntax: MAIL FROM:<address>'))
    
    def testDuplicateMailCommand(self):
        """Nested MAIL commands are not allowed."""
        self.assertEqual(self.smtp.docmd('MAIL FROM:<me@example.com>'), (250, 'Ok'))
        self.assertEqual(self.smtp.docmd('MAIL FROM:<me@example.com>'), (503, 'Error: nested MAIL command'))
        
    def testRcptWithoutMail(self):
        """The RCPT command must be preceded by the MAIL command."""
        self.assertEqual(self.smtp.docmd('RCPT TO:<me@example.com>'), (503, 'Error: need MAIL command'))
        
    def testRcptWithoutTo(self):
        """The RCPT command must contain TO:<address> as the argument."""
        self.assertEqual(self.smtp.docmd('MAIL FROM:<you@example.com>'), (250, 'Ok'))
        self.assertEqual(self.smtp.docmd('RCPT'), (501, 'Syntax: RCPT TO: <address>'))
    
    def testRcptEmptyTo(self):
        """The RCPT command cannot have an empty TO:."""
        self.assertEqual(self.smtp.docmd('MAIL FROM:<you@example.com>'), (250, 'Ok'))
        self.assertEqual(self.smtp.docmd('RCPT TO:'), (501, 'Syntax: RCPT TO: <address>'))

    def testRcptInvalidTo(self):
        """The RCPT command TO: argument must be a valid address."""
        self.assertEqual(self.smtp.docmd('MAIL FROM:<you@example.com>'), (250, 'Ok'))
        self.assertEqual(self.smtp.docmd('RCPT TO:<invalid@example.com>'), (553, 'Mailbox name invalid'))
        
    def testDataWithoutRcpt(self):
        """The DATA command must be preceded by the RCPT TO: command."""
        self.assertEqual(self.smtp.docmd('DATA'), (503, 'Error: need RCPT command'))
    
    def testDataIllegalArgument(self):
        """The DATA command does not take any arguments."""
        self.assertEqual(self.smtp.docmd('MAIL', 'FROM:<you@example.com>') , (250, 'Ok'))
        self.assertEqual(self.smtp.docmd('RCPT', 'TO:<me@example.com>') , (250, 'Ok'))
        self.assertEqual(self.smtp.docmd('DATA', 'some data here') , (501, 'Syntax: DATA'))
        
if __name__ == "__main__":
    unittest.main()
