import * as Adapter from 'socket.io-adapter'
import * as msgpack from 'notepack.io'
import * as uid2 from 'uid2'
import * as Debug from 'debug'
import * as Kafka from 'node-rdkafka'
import { Namespace } from 'socket.io'

const debug = new Debug('socket.io-kfk')
const adapterStore: { [ns: string]: Adapter } = {}
const DEFAULT_KAFKA_TOPIC = 'socketio'
const uid = uid2(6)
let consumer: any | null = null
let producer: any | null = null

export class KafkaAdapterOpts {
  brokerList: string
  topic: string
  group: string
}

export function initKafkaAdapter(opts: KafkaAdapterOpts) {
  const p = new Kafka.Producer(
    {
      'client.id': 'socket-io',
      'metadata.broker.list': opts.brokerList,
    },
    {},
  )
  p.connect()
  p.on('ready', function() {
    producer = p
  })

  const c = new Kafka.KafkaConsumer(
    {
      'group.id': opts.group,
      'metadata.broker.list': opts.brokerList,
      rebalance_cb: function(err, assignment) {
        console.log('assignment', assignment)
        if (err.code === Kafka.CODES.ERRORS.ERR__ASSIGN_PARTITIONS) {
          // Note: this can throw when you are disconnected. Take care and wrap it in
          // a try catch if that matters to you
          this.assign(assignment)
        } else if (err.code == Kafka.CODES.ERRORS.ERR__REVOKE_PARTITIONS) {
          // Same as above
          this.unassign()
        } else {
          // We had a real error
          console.error(err)
        }
      },
    },
    {},
  )
  c.connect()
  c.on('ready', function() {
    consumer = c

    consumer.subscribe([opts.topic || DEFAULT_KAFKA_TOPIC])

    // listen kafka topic
    onmessage().catch(err => console.error(err))
  })

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
    let disconnected = 0
    producer.disconnect(function() {
      disconnected++
      if (disconnected >= 2) {
        process.exit(0)
      }
    })
    consumer.disconnect(function() {
      disconnected++
      if (disconnected >= 2) {
        process.exit(0)
      }
    })
  }
  process.on('SIGINT', gracefulDeath)
  process.on('SIGQUIT', gracefulDeath)
  process.on('SIGTERM', gracefulDeath)

  consumer.consume(function(err, message) {
    if (err) {
      console.error(err)
      return
    }

    try {
      handleMessage(message.value)
    } catch (err) {
      console.error(err)
    }
  })
}

function handleMessage(message) {
  const args = msgpack.decode(message)
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
}

export class KafkaAdapter extends Adapter {
  private topic: string
  private nsp: Namespace

  constructor(nsp: Namespace, opts: KafkaAdapterOpts) {
    super(nsp)
    this.topic = opts.topic || DEFAULT_KAFKA_TOPIC
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
    try {
      debug('broadcast message %o', packet)
      packet.nsp = this.nsp.name
      if (!(remote || (opts && opts.flags && opts.flags.local))) {
        const raw = [uid, packet, opts]
        const msg = msgpack.encode(raw)
        debug('publishing msg %s', raw)

        producer.produce(this.topic, null, Buffer.from(msg))
        debug('produce raw msg success: %s', raw)
      }

      super.broadcast(packet, opts, remote)
    } catch (err) {
      console.error(err)
    }
  }
}
