const io = require('socket.io-client')

const manager = new io.Manager('http://localhost:7777')

const nsp = manager.socket('/nsp')

nsp.on('connect', function() {
  console.log('connected')
})

nsp.on('callback', function (data) {
  console.log('callback ', data)
})

const msg = 'test message 中文'
nsp.emit('event', msg)
