const http = require('http')
const IO = require('socket.io')
const initKafkaAdapter = require('../dist').initKafkaAdapter

const port = 7777
const user = '1'

async function main() {
  const server = http.createServer()
  const io = IO(server)
  const opts = {
    brokerList: '127.0.0.1:9092',
    group: 'group' + user,
    topic: 'socketio',
  }
  const adapter = initKafkaAdapter(opts)
  io.adapter(adapter)

  const nsp = io.of('/nsp')

  nsp.on('connection', socket => {
    const room = '0'
    socket.join(room)
    
    socket.on('event', data => {
      console.log('event', data)

      nsp.to(room).emit('callback', data)
    })

    socket.on('disconnect', () => {
      console.log('disconnect')
    })
  })

  server.listen(port)
}

main()
