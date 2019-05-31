#!/usr/bin/python
# -*- coding: utf-8 -*-

from smtplib import SMTP
from telnetlib import Telnet
import unittest

class SequentialTests(unittest.TestCase):
    
    addrs = [
        'bob@example.com', 'sheila@example.com', 'kurt@example.com',
        'wendy@example.com', 'tim@example.com'
        ]
        
    def testStarttls(self):
        """starttls is supported"""
        
        smtp = SMTP('localhost', 1025)
        smtp.set_debuglevel(True) # turns on client side debug messages

        smtp.ehlo()
        print "does_esmtp = " + str(smtp.does_esmtp)
        print "esmtp_features = " + str(smtp.esmtp_features)

        smtp.starttls()

        response = smtp.sendmail(
            'alice@example.com',
            'bob@example.com',
            'This is a test message\nSecond line.\nFinal line here.'
        )
        self.assertEqual(response, {})
        smtp.quit()

if __name__ == "__main__":
    unittest.main()
