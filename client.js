const net = require('net');
const fs = require('fs');


const PORT = 3000;
const HOST = 'localhost'; 

let BUFFER_COLLECTOR = Buffer.alloc(0);
let receivedPackets = [];

//////////////////////////////////////////////////////////////////////////////////

// This function is for connecting to the BetaCrew Server
const client = net.createConnection({ host: HOST, port: PORT }, () => {
  console.log('Connected to BetaCrew server');
  
  const requestPayload = Buffer.from([0x01, 0x00]); 
  client.write(requestPayload);
});


client.on('data', (data) => {
  BUFFER_COLLECTOR = Buffer.concat([BUFFER_COLLECTOR, data]);

  
  const PACKET_LENGTH = 17;

  // Process packets from the buffer
  while (BUFFER_COLLECTOR.length >= PACKET_LENGTH) {
    const packet = BUFFER_COLLECTOR.slice(0, PACKET_LENGTH);
    BUFFER_COLLECTOR = BUFFER_COLLECTOR.slice(PACKET_LENGTH);

    const parsedPacket = parsePacket(packet);
    if (parsedPacket) {
      receivedPackets.push(parsedPacket);
    }
  }


  ensurePacketsInSequence(receivedPackets);
});

////////////////////////////////////////////////////////////////////////////////////

client.on('end', () => {
  console.log('Disconnected from server');
  
  fs.writeFileSync('output.json', JSON.stringify(receivedPackets, null, 2));
  console.log('Packets saved to output.json');
});


// This function is fro parsing data

function parsePacket(buffer) {
  if (buffer.length < 17) {
    console.error('Buffer is small to parse packet');
    return null;
  }
  try {
    return {
      symbol: buffer.slice(0, 4).toString('ascii'),           //symbol
      buysellindicator: buffer.slice(4, 5).toString('ascii'), //buy/sell indicator
      quantity: buffer.readInt32BE(5),                        //quantity
      price: buffer.readInt32BE(9),                           //price
      packetSequence: buffer.readInt32BE(13)                  //packet sequence
    };
  } catch (err) {
    console.error('Error parsing packet:', err);
    return null;
  }
}

/////////////////////////////////////////////////////////////////////////////////////////
// This function is for ensuring no missing packets
function ensurePacketsInSequence(packets) {
  for (let i = 0; i < packets.length - 1; i++) {
    const currentSeq = packets[i].packetSequence;
    const nextSeq = packets[i + 1].packetSequence;
    
    if (nextSeq !== currentSeq + 1) {
      const missingSeq = currentSeq + 1;
      console.log(`Requesting missing packet with sequence: ${missingSeq}`);
      const resendPayload = Buffer.from([0x02, missingSeq]);
      client.write(resendPayload);
    }
  }
}
