import * as Adapter from 'socket.io-adapter'
import * as msgpack from 'notepack.io'
import * as uid2 from 'uid2'
import * as Debug from 'debug'
import { KafkaProducer, KafkaALOConsumer } from 'kfk'
import { Namespace, Server, Rooms, Room, Packet, ServerOptions } from 'socket.io'

const debug = new Debug('socket-io-kfk')
const adapterStore: { [ns: string]: Adapter } = {}
const KAFKA_TOPIC = 'socket_io_msg'
let consumer: KafkaALOConsumer | null = null
let producer: KafkaProducer | null = null

export class KafkaAdapterOpts {
  prefix: string
  brokerList: string
  consumerGroupId: string
}

export function initKafkaAdapter(opts: KafkaAdapterOpts) {
  consumer = new KafkaALOConsumer(
    {
      'group.id': opts.consumerGroupId,
      'metadata.broker.list': opts.brokerList,
    },
    {
      'auto.offset.reset': 'largest',
    },
  )
  producer = new KafkaProducer(
    {
      'client.id': 'socket-io',
      'metadata.broker.list': opts.brokerList,
    },
    {},
  )

  producer
    .connect()
    .then(() =>
      consumer!.connect().then(() => consumer!.subscribe([KAFKA_TOPIC]).then(() => onmessage())),
    )

  function adapter(nsp: Namespace) {
    const ap = new KafkaAdapter(nsp, opts)
    adapterStore[nsp.name] = ap
    return ap
  }

  return adapter
}

async function onmessage() {
  const gracefulDeath = async () => {
    await producer!.die()
    await consumer!.die()
    process.exit(0)
  }
  process.on('SIGINT', gracefulDeath)
  process.on('SIGQUIT', gracefulDeath)
  process.on('SIGTERM', gracefulDeath)

  while (true) {
    await consumer!.consume(
      message => {
        const msg = message.value.toString('utf-8')
        const args = msgpack.decode(msg)
        const packet = args[1]
        const opts = args[2]
        if (adapterStore[packet.nsp]) {
          adapterStore[packet.nsp].broadcast(packet, opts, true)
        }
      },
      {
        size: 100,
        concurrency: 5,
      },
    )
  }
}

export class KafkaAdapter extends Adapter {
  private uid: string
  private prefix: string
  private channel: string
  private nsp: Namespace
  private rooms: Rooms
  /**
   * A dictionary of all the socket ids that we're dealing with, and all
   * the rooms that the socket is currently in
   */
  private sids: { [id: string]: { [room: string]: boolean } }
  private producer: KafkaProducer
  private consumer: KafkaALOConsumer

  constructor(nsp: Namespace, opts: KafkaAdapterOpts) {
    super(nsp)

    this.uid = uid2(6)
    this.rooms = {}
    this.sids = {}

    this.prefix = opts.prefix || 'socket.io'
    this.channel = this.prefix + '#' + this.nsp.name + '#'
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
    packet.nsp = this.nsp.name
    if (!(remote || (opts && opts.flags && opts.flags.local))) {
      let channel = this.channel
      if (opts.rooms && opts.rooms.length === 1) {
        channel += opts.rooms[0] + '#'
      }
      const msg = msgpack.encode([this.uid, packet, opts])
      debug('publishing message to channel %s', channel)
      this.producer.produce(KAFKA_TOPIC, null, msg, channel)
    }

    super.broadcast(packet, opts, remote)
  }
}
