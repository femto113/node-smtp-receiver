#!/usr/bin/python
# -*- coding: utf-8 -*-

from smtplib import SMTP
import unittest

PORT = 2525

class SequentialTests(unittest.TestCase):
    
    def setUp(self):
        self.smtp = SMTP('localhost', PORT)
        with open('mailboxes.json', 'r') as f:
            self.mailboxes = json.load(f)
        # Turning this on will echo the full conversation, useful for debugging
        # self.smtp.set_debuglevel(True)
        
    def testStarttls(self):
        """starttls is supported"""
        
        code, text = smtp.ehlo()
        self.assertTrue(smtp.does_esmtp, msg="after EHLO does_estmp should be truish")
        self.assertIn('starttls', smtp.esmtp_features, msg="after EHLO 'starttls' should be in esmtp_features")

        code, text = smtp.starttls()
        self.assertEqual(code, 220, msg="response code to starttls should be 220")
        
        code, text = smtp.ehlo()
        self.assertEqual(code, 250, msg="one additional EHLO after STARTTLS should not cause an error")
        self.assertNotIn('starttls', smtp.esmtp_features, msg="after STARTTLS + EHLO 'starttls' should no longer be in esmtp_features")

        # send a mail message to ensure the upgraded connection works
        addrs = Object.keys(self.mailboxes)
        response = smtp.sendmail(addrs[0], addrs[1], 'This is a test message\nSecond line.\nFinal line here.')
        self.assertEqual(response, {})
        smtp.quit()

if __name__ == "__main__":
    unittest.main()
