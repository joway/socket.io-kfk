const http = require('http')
const IO = require('socket.io')
const initKafkaAdapter = require('../dist').initKafkaAdapter

const port = 8888
const user = '2'

function parseHeader(socket, next) {
  if (!socket['USER']) {
    socket['USER'] = {}
  }
  socket['USER']['id'] = socket.request.headers['id']
  return next()
}

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
  nsp.use(parseHeader)

  nsp.on('connection', socket => {
    const room = socket['USER']['id']
    socket.join(room)

    socket.on('event', data => {
      console.log('event', data)

      nsp.to(room).emit('callback', data)
    })

    socket.on('exchange', (data) => {
      const room = data.split('|')[0]
      nsp.to(room).emit('callback', data.split('|')[1])
    })

    socket.on('disconnect', () => {
      console.log('disconnect')
    })
  })

  server.listen(port)
}

main()
