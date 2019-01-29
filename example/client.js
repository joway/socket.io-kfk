const io = require('socket.io-client')

const manager1 = new io.Manager('http://localhost:7777', {
  transportOptions: { polling: { extraHeaders: { id: '1' } } },
})
const manager2 = new io.Manager('http://localhost:8888', {
  transportOptions: { polling: { extraHeaders: { id: '2' } } },
})

const nsp1 = manager1.socket('/nsp')
const nsp2 = manager2.socket('/nsp')

nsp1.on('connect', function(e) {
  console.log('1 connected')
})
nsp1.on('connect', function(e) {
  console.log('2 connected')
})

nsp1.on('callback', function(data) {
  console.log('user 1 get data: ', data)
})
nsp2.on('callback', function(data) {
  console.log('user 2 get data: ', data)
})

for (let i = 0; i < 5; i++) {
  const rand = Math.random()
    .toString(36)
    .substring(7)

  const user = (i % 2) + 1
  const msg = 'user ' + user + ' send: 中文'

  if (user === 1) {
    nsp1.emit('event', msg)
  } else {
    nsp2.emit('event', msg)
  }
}
