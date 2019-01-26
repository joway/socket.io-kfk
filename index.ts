import * as Adapter from 'socket.io-adapter'
import * as msgpack from 'notepack.io'
import * as uid2 from 'uid2'
import * as Debug from 'debug'
import { Kafka } from 'kafkajs'
import { Namespace } from 'socket.io'

const debug = new Debug('socket.io-kfk')
const adapterStore: { [ns: string]: Adapter } = {}
const KAFKA_TOPIC = 'socket_io_msg'
const uid = uid2(6)
let consumer: any | null = null
let producer: any | null = null

export class KafkaAdapterOpts {
  brokerList: string
  consumerGroupId: string
}

export function initKafkaAdapter(opts: KafkaAdapterOpts) {
  const kafka = new Kafka({
    clientId: 'socket-io',
    brokers: opts.brokerList.split(','),
  })
  consumer = kafka.consumer({
    groupId: opts.consumerGroupId,
    heartbeatInterval: 1000,
    sessionTimeout: 10000,
  })
  producer = kafka.producer()

  producer!
    .connect()
    .then(() =>
      consumer!
        .connect()
        .then(() => consumer!.subscribe({ topic: KAFKA_TOPIC }).then(() => onmessage())),
    )

  function adapter(nsp: Namespace) {
    debug('init adapter with nsp: %s', nsp.name)
    const ap = new KafkaAdapter(nsp, opts)
    adapterStore[nsp.name] = ap
    return ap
  }

  return adapter
}

async function onmessage() {
  debug('setting gracefulDeath for consumer')
  const gracefulDeath = async () => {
    await producer!.disconnect()
    await consumer!.disconnect()
    process.exit(0)
  }
  process.on('SIGINT', gracefulDeath)
  process.on('SIGQUIT', gracefulDeath)
  process.on('SIGTERM', gracefulDeath)

  while (true) {
    await consumer.run({
      autoCommitInterval: 1000,
      autoCommitThreshold: 100,
      eachMessage: async ({ topic, partition, message }) => {
        const msg = message.value
        const args = msgpack.decode(msg)
        const _uid = args[0]
        const packet = args[1]
        const opts = args[2]

        if (!(_uid && packet && opts)) {
          return debug('invalid params')
        }

        if (uid === _uid) {
          return debug('ignore same uid')
        }

        debug('fetch packet: packet(%o) args(%o)', packet, args)
        const adapter = adapterStore[packet.nsp]
        if (!adapter) {
          return debug('skip unknown nsp')
        }

        if (packet.nsp === undefined) {
          packet.nsp = '/'
        }
        if (packet.nsp !== adapter.nsp.name) {
          return debug('ignore different namespace')
        }

        if (opts.rooms && opts.rooms.length === 1) {
          const room = opts.rooms[0]
          if (room !== '' && !adapter.rooms.hasOwnProperty(room)) {
            return debug('ignore unknown room %s', room)
          }
        }

        adapter.broadcast(packet, opts, true)
      },
    })
  }
}

export class KafkaAdapter extends Adapter {
  private nsp: Namespace
  /**
   * A dictionary of all the socket ids that we're dealing with, and all
   * the rooms that the socket is currently in
   */
  private producer: any
  private consumer: any

  constructor(nsp: Namespace, opts: KafkaAdapterOpts) {
    super(nsp)
  }

  /**
   * Broadcasts a packet.
   *
   * @param {Object} packet to emit
   * @param {Object} options
   * @param {Boolean} remote the packet came from another node
   * @api public
   */
  broadcast(packet: any, opts: any, remote: boolean) {
    debug('broadcast message %o', packet)
    packet.nsp = this.nsp.name
    if (!(remote || (opts && opts.flags && opts.flags.local))) {
      const raw = [uid, packet, opts]
      const msg = msgpack.encode(raw)
      debug('publishing msg %s', raw)
      producer!
        .send({
          topic: KAFKA_TOPIC,
          messages: [
            {
              key: msg,
              value: msg,
            },
          ],
        })
        .then(() => debug('produce raw msg success: %s', raw))
    }

    super.broadcast(packet, opts, remote)
  }
}
