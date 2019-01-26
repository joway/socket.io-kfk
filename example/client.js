const io = require('socket.io-client')

var socket = io('http://localhost:7777')
socket.emit('event', 'test message')
