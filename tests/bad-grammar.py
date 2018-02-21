#!/usr/bin/python
# -*- coding: utf-8 -*-

from smtplib import SMTP
from telnetlib import Telnet
import unittest

class BadGrammarTests(unittest.TestCase):
    
    def setUp(self):
        self.smtp = SMTP('localhost', 1025)

    def tearDown(self):
        self.smtp.quit()
        self.smtp.close()
        self.smtp = None
  
    def testUnimplementedEhlo(self):
        """Unknown commands are ignored and the self.smtp informed."""
        self.assertEqual(self.smtp.ehlo(), (502, 'Error: command "EHLO" not implemented'))
        
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
        
    def xtestRcptWithoutTo(self):
        """The RCPT command must contain TO:<address> as the argument."""
        self.assertEqual(self.smtp.docmd('MAIL FROM:<you@example.com>'), (250, 'Ok'))
        self.assertEqual(self.smtp.docmd('RCPT'), (501, 'Syntax: RCPT TO: <address>'))
    
    def testRcptEmptyTo(self):
        """The RCPT command cannot have an empty TO:."""
        self.assertEqual(self.smtp.docmd('MAIL FROM:<you@example.com>'), (250, 'Ok'))
        self.assertEqual(self.smtp.docmd('RCPT TO:'), (501, 'Syntax: RCPT TO: <address>'))
        
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
