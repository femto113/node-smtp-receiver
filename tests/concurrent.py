import json
from os import path
from smtplib import SMTP
from threading import Thread
import argparse
from time import sleep
from random import choice

PORT = 2525

MESSAGE_PATH = path.abspath(path.join(path.dirname(__file__), 'message.txt'))
MAILBOXES_PATH = path.abspath(path.join(path.dirname(__file__), 'mailboxes.json'))

class SendMessageThread(Thread):

    def __init__(self, client_number, message, addrs, *args, **kwargs):
        super(SendMessageThread, self).__init__(*args, **kwargs)
        self._client_number = client_number
        self._message = message
        self._from = 'client%d@example.com' % self._client_number
        self._to = addrs[self._client_number % len(addrs)]
    
    def run(self):
        attempts = 10
        while attempts > 0:
            try:
                # print 'Starting client: %d' % self._client_number
                server = SMTP('127.0.0.1', PORT)
                response = server.sendmail(self._from, self._to, self._message)
                server.quit()
                server.close()
        
                assert response == {}
        
                print 'Success: %d' % self._client_number
                return
            except Exception as e:
                attempts -= 1
                sleep(0.001)
        print "Failure: %d (made 10 attempts)" % self._client_number

def main():
    parser = argparse.ArgumentParser(description='Process some integers.')
    parser.add_argument('threads', metavar='N', nargs='?', type=int, default=512, help='number of concurrent threads to fire up')
    args = parser.parse_args()

    with open(MESSAGE_PATH) as f:
        message = f.read()

    with open(MAILBOXES_PATH) as f:
        addrs = json.load(f).keys()
    
    message_threads = []
    for i in xrange(args.threads):
        message_threads.append(SendMessageThread(i, message, addrs))

    print "Starting %d threads..." % len(message_threads)
    for t in message_threads:
        t.start()
        if choice([True, False]):
            sleep(0.001) # fuzz up the start times a tiny bit, prevents "too many open files" errors
        
    
if __name__ == "__main__":
    main()
