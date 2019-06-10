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
        # smtp = SMTP('ec2-18-208-163-245.compute-1.amazonaws.com', 25)
        smtp.set_debuglevel(True) # turns on client side debug messages

        code, text = smtp.ehlo()
        self.assertTrue(smtp.does_esmtp, msg="after EHLO does_estmp should be truish")
        self.assertIn('starttls', smtp.esmtp_features, msg="after EHLO 'starttls' should be in esmtp_features")

        code, text = smtp.starttls()
        self.assertEqual(code, 220, msg="response code to starttls should be 220")
        
        code, text = smtp.ehlo()
        self.assertEqual(code, 250, msg="one additional EHLO after STARTTLS should not cause an error")
        self.assertNotIn('starttls', smtp.esmtp_features, msg="after STARTTLS + EHLO 'starttls' should no longer be in esmtp_features")

        response = smtp.sendmail(
            'alice@example.com',
            'bob@example.com',
            'This is a test message\nSecond line.\nFinal line here.'
        )
        self.assertEqual(response, {})
        smtp.quit()

if __name__ == "__main__":
    unittest.main()
