const io = require('socket.io-client')

const CONNECT_URL = 'http://localhost:8888'
const manager = new io.Manager(CONNECT_URL)
const nsp = manager.socket('/nsp')
for (let i = 0; i < 1; i++) {
  const rand = Math.random()
    .toString(36)
    .substring(7)
  const msg = 'test num ' + i + ' rand ' + rand + ' message + 中文'

  nsp.emit('event', msg, function() {
    process.exit()
  })
}
