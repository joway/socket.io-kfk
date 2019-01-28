const http = require('http')
const IO = require('socket.io')
const initKafkaAdapter = require('../dist').initKafkaAdapter

const port = 8888

async function main() {
  const server = http.createServer()
  const io = IO(server)
  const opts = {
    brokerList: '127.0.0.1:9092',
    group: 'group2',
    topic: 'socketio',
  }
  const adapter = initKafkaAdapter(opts)
  io.adapter(adapter)

  const nsp = io.of('/nsp')
  nsp.on('connection', client => {
    client.on('event', data => {
      console.log('event', data)

      nsp.emit('nsp', data)
    })

    client.on('nsp', data => {
      console.log('nsp', data)
    })

    client.on('disconnect', () => {
      console.log('disconnect')
    })
  })

  server.listen(port)
}

main()
