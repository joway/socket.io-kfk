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

const begin = new Date()
for (let i = 0; i < 5000; i++) {
  const rand = Math.random()
    .toString(36)
    .substring(7)

  if (i % 4 === 0) {
    const msg = 'user 1 send: 中文'
    nsp1.emit('event', msg)
  } else if (i % 4 === 1) {
    const msg = 'user 2 send: 中文'
    nsp2.emit('event', msg)
  } else if (i % 4 === 2) {
    const msg = '2|user 1 send: 中文 to user 2'
    nsp1.emit('exchange', msg)
  } else {
    const msg = '1|user 2 send: 中文 to user 1'
    nsp2.emit('exchange', msg)
  }
}
const end = new Date()
console.log(end - begin)
