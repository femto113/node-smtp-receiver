Blackbox tests
==============

The tests in this section are _"black box"_ tests or, put another way, tests
which test the system as a whole without concerning the code behind the module.

To run the tests, you will need to have node installed (obviously!) and have a
version of python as the SMTP client uses the built in one in python's standard
library. The tests have all been verified with python 2.7.

Note: all tests require the test server to be running

	% node test-server.js

To invoke the tests run any of the following;

    * grammar.py:    basic SMTP grammar
    * starttls.py:   ESTMP starttls command
    * concurrent.py: test multiple concurrent threads
