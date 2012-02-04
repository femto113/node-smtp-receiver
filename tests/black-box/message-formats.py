#!/usr/bin/python
# -*- coding: utf-8 -*-

from os import path
import unittest
from smtplib import SMTP
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage

MESSAGE_PATH = path.abspath(path.join(path.dirname(__file__), 'message.txt'))
KITTENS_PATH = path.abspath(path.join(path.dirname(__file__), 'kittens.jpg'))

# NOTE: for debugging it may be useful to turn on client side debugging messages, e.g.
#   server = SMTP('localhost', 1025)
#   server.set_debuglevel(True)

class MessageTests(unittest.TestCase):
    
    addrs = [
        'bob@example.com', 'sheila@example.com', 'kurt@example.com',
        'wendy@example.com', 'tim@example.com'
        ]

    def testText(self):
        """a simple text message can be sent"""

        with open(MESSAGE_PATH, 'rb') as fp:
          msg = MIMEText(fp.read());

        msg['Subject'] = "Can you read this?"

        server = SMTP('localhost', 1025)
        msg_string = msg.as_string()
        print "sending %d character text message" % len(msg_string)
        response = server.sendmail('text@example.com', self.addrs[0], msg_string)
        server.quit()

        self.assertEqual(response, {})

    def testImage(self):
        """a message with an attached image can be sent"""
        
        # Create the container (outer) email message.
        msg = MIMEMultipart()
        msg['Subject'] = "Kittens!"
        msg.preamble = 'ZOMG!!1! so cuuuute'

        with open(KITTENS_PATH, 'rb') as fp: # Open the file in binary mode
            img = MIMEImage(fp.read()) # Let the MIMEImage class automatically guess the specific image type
            msg.attach(img)

        server = SMTP('localhost', 1025)
        # server.set_debuglevel(True) # turns on client side debug messages
        msg_string = msg.as_string()
        print "sending %d character image message" % len(msg_string)
        response = server.sendmail('kittenfan@example.com', self.addrs, msg.as_string())
        server.quit()

        self.assertEqual(response, {})
        
    def testMixed(self):
        """a message with attached text and image can be sent"""

        # Create the container (outer) email message.
        msg = MIMEMultipart()
        msg['Subject'] = "Some stuff for you"

        with open(MESSAGE_PATH) as fp:
            msg.attach(MIMEText(fp.read()));

        with open(KITTENS_PATH, 'rb') as fp: # Open the file in binary mode
            msg.attach(MIMEImage(fp.read())) # Let the MIMEImage class automatically guess the specific image type

        server = SMTP('localhost', 1025)
        # server.set_debuglevel(True) # turns on client side debug messages
        msg_string = msg.as_string()
        print "sending %d character multi-part (text + image) message" % len(msg_string)
        response = server.sendmail('kittenfan@example.com', self.addrs, msg.as_string())
        server.quit()

        self.assertEqual(response, {})

if __name__ == "__main__":
    unittest.main()
