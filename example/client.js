const io = require('socket.io-client')

const CONNECT_URL = 'http://localhost:7777'
const manager = new io.Manager(CONNECT_URL)
const nsp = manager.socket('/nsp')
for (let i = 0; i < 100; i++) {
  const msg = 'test num ' + i + ' message + 中文'
  nsp.emit('event', msg)
}
