const http = require('http')
const SocketIO = require('socket.io')
const initKafkaAdapter = require('../dist').initKafkaAdapter

async function main() {
  const server = http.createServer()
  const io = SocketIO(server)
  const opts = {
    prefix: 'socket-io',
    brokerList: '127.0.0.1:9092',
    consumerGroupId: 'socket-io',
  }
  const adapter = initKafkaAdapter(opts)
  io.adapter(adapter)

  io.on('connection', client => {
    client.on('event', data => {
      console.log('event', data)
    })
    client.on('disconnect', () => {
      console.log('disconnect')
    })
  })
  server.listen(7777)
}

main()
