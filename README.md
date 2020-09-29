# Sniffer for 'Midea'-UART protocol

This script implements a sniffer for the 'Midea'-UART protocol to support examining and reverse engineering of the protocol. Various vendors of air conditioners, (de-)humidifiers and fans, use a dongle, called the SmartKey, to provide a WiFi interface to control the appliance using a mobile app.

Examples of vendors using this interface for their appliances:

* Midea
* Qlima
* Artel
* Carrier
* Pioneer

This dongle wraps the UART protocol used to communicate with the appliance with a layer for authentication and encryption for communication with a mobile app via the Midea cloud or directly via a local LAN connection. It turns out the dongle is just connected to a serial interface (TTL level) of the appliance. To examine and reverse engineer the protocol we can snif the communication between dongle and appliance by replacing the dongle with a TCP-Serial bridge, based on an ESP8266, and connecting the WiFi SmartKey to a computer using a USB-TTL interface. More information on how to create the TCP-Serial bridge and how to connected everything can be found in [ADAPTER.md](./ADAPTER.md).

## Installation of the script
To install the script clone it to your computer:

```bash
$ git clone https://github.com/reneklootwijk/midea-uartsniffer.git
```

Install the dependencies:

```bash
$ cd midea-uartsniffer
$ npm install
```

Modify the script by adding the address of the TCP-Serial bridge and the serial port to which the WiFi SmartKey is connected:

```javascript
const applianceHost = '<IP address of TCP-Serial bridge>'
const smartKeyPort = '<Serial port connected to WiFi SmartKey>'
```

When the TCP-Serial bridge has been installed and the WiFi SmartKey has been connected to your computer, run the script:

```bash
$ node sniffer.js
```

## Output
When everything is connected correctly and the TCP-Serial bridge has been configured correctly, the output of the script will look as follows:

```bash
2020-09-27T10:14:21.435Z: SK: aa1eacb200000000030d0101044a05a8c0ff000001010000000000000000b6
2020-09-27T10:14:21.609Z: SK: aa20ac00000000000003418100ff03ff000200000000000000000000000003cd9c
2020-09-27T10:14:21.967Z: AP: aa1eac0000000000030d0101044a05a8c0ff00000101000000000000000068
2020-09-27T10:14:22.617Z: SK: aa0fac00000000000203b1011500a6d3
2020-09-27T10:15:29.702Z: SK: aa1eacb200000000030d0101044a05a8c0ff000001010000000000000000b6
2020-09-27T10:15:30.239Z: AP: aa1eac0000000000030d0101044a05a8c0ff00000101000000000000000068
```

Where:

* SK prefixes the messages send by the WiFi SmartKey
* AP prefixes the messages send by the appliance
