# distribus

A scalable, distributed message bus for node.js and the browser.

Send messages between peers in a peer-to-peer network. Mbus uses a distributed
hash table to locate peers and route messages to peers. This results in a
scalable, unstructured, and self repairing network.

Distribus can be used to

- Send messages between peers
- Broadcast messages
- Publish/subscribe


## Install

Install via npm:

    npm install distribus


## Use

Sorry, you can't yet use it... coming soon though.


## Literature

- [Kademlia (Wikipedia)](http://en.wikipedia.org/wiki/Kademlia)
- [kademlia (Paper)](http://pdos.csail.mit.edu/~petar/papers/maymounkov-kademlia-lncs.pdf)
- [Distributed hash table](http://en.wikipedia.org/wiki/Distributed_hash_table)
- [Tutorial](http://tutorials.jenkov.com/p2p/index.html)
- [16-dht.pdf](https://www.cs.cmu.edu/~dga/15-744/S07/lectures/16-dht.pdf)
- [Distributed applications and node.js](http://ajlopez.wordpress.com/2013/05/30/aplicaciones-distribuidas-y-node-js/)


## Inspiration

- [kadoh](http://jinroh.github.io/kadoh/)
- [node-dht](https://github.com/stbuehler/node-dht)
- [kademlia](https://github.com/nikhilm/kademlia)
- [dht.js](https://github.com/indutny/dht.js)
- [node-telehash](https://github.com/mnaamani/node-telehash)
- [SimpleMessages](https://github.com/ajlopez/SimpleMessages)


## Test

To execute tests for the library, install the project dependencies once:

    npm install

Then, the tests can be executed:

    npm test

To test code coverage of the tests:

    npm run coverage

To see the coverage results, open the generated report in your browser:

    ./coverage/lcov-report/index.html


## License

Copyright (C) 2014 Jos de Jong <wjosdejong@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
