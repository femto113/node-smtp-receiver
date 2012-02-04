from os import path
from smtplib import SMTP
from threading import Thread
import argparse
from time import sleep
from random import choice

MESSAGE_PATH = path.abspath(path.join(path.dirname(__file__), 'message.txt'))

class SendMessageThread(Thread):
    
    def __init__(self, client_number, message, *args, **kwargs):
        super(SendMessageThread, self).__init__(*args, **kwargs)
        self._client_number = client_number
        self._message = message
        self._from = 'client%d@example.com' % self._client_number
    
    def run(self):
        print 'Starting client: %d' % self._client_number
        # server = SMTP('localhost', 1025)
        server = SMTP('127.0.0.1', 1025)
        response = server.sendmail(self._from, 'you@example.com', self._message)
        server.quit()
        
        assert response == {}
        
        print 'Finished message from client: %d' % self._client_number


def main():
    parser = argparse.ArgumentParser(description='Process some integers.')
    parser.add_argument('threads', metavar='N', nargs='?', type=int, default=512, help='number of concurrent threads to fire up')
    args = parser.parse_args()

    # message = open(MESSAGE_PATH).read() #TODO: close file else too many open files errors
    with open(MESSAGE_PATH) as f:
        message = f.read()

    message_threads = []
    for i in xrange(args.threads):
        message_threads.append(SendMessageThread(i, message))

    print "Starting %d threads..." % len(message_threads)
    for t in message_threads:
        t.start()
        if choice([True, False]):
            sleep(0.003) # fuzz up the start times a tiny bit, prevents "too many open files" errors

    
if __name__ == "__main__":
    main()
