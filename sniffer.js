// WiFi SmartKey -> TTL-USB adapter -> PC -> WiFi -> TCP-Serial bridge -> Appliance
// Receive on serial -> Copy on network connection
// Receive on network connection -> Copy on serial

'use strict'

const EventEmitter = require('events').EventEmitter
const logger = require('winston')
const net = require('net')
const SerialPort = require('serialport')

const applianceHost = '192.168.5.122'
const smartKeyPort = '/dev/cu.usbserial-A600dVFD'

logger.remove(logger.transports.Console)
logger.add(new logger.transports.Console({
  format: logger.format.combine(
    logger.format.timestamp(),
    logger.format.colorize(),
    logger.format.printf(event => {
      return `${event.timestamp}: ${event.message}`
    })
  ),
  level: 'info'
}))

class Appliance extends EventEmitter {
  constructor (options = {}) {
    super()

    if (!options.host) {
      throw new Error('Cannot create Appliance connection, no host specified')
    }

    this.host = options.host
    this.port = options.port || 23

    this._connection = null
    this.connected = false

    this._rcvBuf = []

    this._cmdTimer = null
    this._cmdInProgress = false
    this._cmdQueue = []
  }

  connect () {
    var self = this

    logger.debug('Appliance: Connecting')

    return new Promise((resolve, reject) => {
      self._connection = net.createConnection(self.port, self.host)

      self._connection.on('connect', () => {
        // Set connection flag
        self.connected = true

        logger.debug(`Appliance.connect: Connected to ${applianceHost}`)

        // Emit connected event
        self.emit('connected')

        resolve()
      })

      // Process received data
      self._connection.on('data', function (data) {
        logger.debug(`Appliance.connect: Received data: ${data.toString('hex')}`)

        self.emit('data', data)
      })

      // Handler for connection end
      self._connection.on('close', function () {
        // Reset connection flag
        self.connected = false

        // Emit disconnected event
        self.emit('disconnected')

        logger.error('Appliance: Closed')

        // Reconnect logic
        setTimeout(function () {
          logger.debug('Appliance: Reconnecting')

          self.connect()
        }, 1000)
      })

      // Handler for errors
      self._connection.on('error', function (err) {
        logger.error(`Appliance.connect: ${err.message}`)
      })
    })
  }

  write (data) {
    var self = this

    return new Promise((resolve, reject) => {
      logger.debug(`Appliance.write: Write ${data.toString('hex')}`)

      self._connection.write(data, (err) => {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })
  }
}

class SmartKey extends EventEmitter {
  constructor (options = {}) {
    super()

    if (!options.port) {
      throw new Error('Cannot create connection to SmartKey, no port specified')
    }

    this._port = options.port
    this._baudrate = 9600
    this._parity = 'none'
    this._databits = 8
    this._serialParser = options.serialParser

    this._connection = null
    this.connected = false

    this._rcvBuf = []
  }

  connect () {
    var self = this

    logger.debug('SmartKey.connect: Entering')

    if (!self._connection) {
      self._connection = new SerialPort(self._port, {
        baudRate: self._baudrate,
        dataBits: self._databits,
        parity: self._parity,
        autoOpen: false
      })
    }

    // Handler for open event serial port
    self._connection.on('open', function () {
      logger.debug(`SmartKey.connect: Connected to ${smartKeyPort}`)

      // Set connection flag
      self.connected = true

      // Emit connected event
      self.emit('connected')
    })

    self._connection.on('data', data => {
      // logger.debug(`SmartKey: Received ${data.toString('hex')}`)

      for (let i = 0; i < data.length; i++) {
        if (!self._rcvBuf.length) {
          if (data[i] === 0xAA) {
            self._bytesToRcv = 0
            self._rcvBuf.push(data[i])
          }
        } else {
          if (self._bytesToRcv === 0) {
            self._bytesToRcv = data[i]
          }

          self._bytesToRcv--

          // Add byte to buffer
          self._rcvBuf.push(data[i])

          // When all bytes are received, emit the data
          if (self._bytesToRcv === 0) {
            self.emit('data', Buffer.from(self._rcvBuf))
            self._rcvBuf = []
          }
        }
      }
    })

    self._connection.on('error', function (err) {
      logger.error(`Connection.connect: ${err.message}`)
    })

    // Handler for connection end
    self._connection.on('close', function () {
      self.connected = false

      // Emit disconnected event
      self.emit('disconnected')

      logger.error('Connection: Closed')

      // Reconnect logic
      setTimeout(function () {
        logger.debug('Connection: Reconnecting')

        self._connection.open()
      }, 1000)
    })

    self._connection.open()
  }

  write (data) {
    var self = this

    return new Promise((resolve, reject) => {
      // logger.debug(`SmartKey.write: Write ${data.toString('hex')}`)

      self._connection.write(data, (err) => {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })
  }
}

const appliance = new Appliance({
  host: applianceHost
})

const smartKey = new SmartKey({
  port: smartKeyPort
})

appliance.on('data', data => {
  if (smartKey.connected) {
    logger.info(`AP: ${data.toString('hex')}`)

    smartKey.write(data)
      .catch(error => {
        logger.error(`Failed to write to SmartKey (${error.message})`)
      })
  }
})

smartKey.on('data', data => {
  if (appliance.connected) {
    logger.info(`SK: ${data.toString('hex')}`)

    appliance.write(data)
      .catch(error => {
        logger.error(`Failed to write to Appliance ${error.message})`)
      })
  }
})

appliance.connect()
smartKey.connect()
