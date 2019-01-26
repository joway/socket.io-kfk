# socket.io-kfk

## Usage

### Install

```shell
npm install -S socket-io-kfk
```

### Use Adapter

```js
import * as IO from 'socket-io'
import { initKafkaAdapter } from 'socket-io-kfk'

// create socket.io server
const server = http.createServer()
const io = IO(server)

// init kafka adapter
const opts = {
	prefix: 'socket-io',
	brokerList: '127.0.0.1:9092',
	consumerGroupId: 'socket-io',
}
const adapter = initKafkaAdapter(opts)

// register into socket.io instance
io.adapter(adapter)
```

## Compared to socket-io-redis

`socket-io-redis` is a easy and awesome adapter in socket.io ecology. But it use redis as its internal message queue, which had poor performance when have huge events. Yes, we have redis cluster, but now redis cluster just have a simple PUB/SUB implement: [current implementation will simply broadcast each published message to all other nodes](https://redis.io/topics/cluster-spec).

So, for the reason of scalability, I write this kafka version to ensure socket.io can handle more than 100k events/s messages.

## License

[MIT](https://github.com/joway/socket.io-kfk/blob/master/LICENSE)