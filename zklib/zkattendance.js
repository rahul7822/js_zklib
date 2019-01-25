const attParserLegacy = require('./att_parser_legacy');
const attParserV660 = require('./att_parser_v6.60');
const {Commands, States, ConnectionTypes} = require('./constants');
const {createHeader, removeTcpHeader} = require('./utils');
const timeParser = require('./timestamp_parser'); 

/*
  decodeAttendanceData(attdata) {
    switch (this.attendanceParser) {
      case attParserV660.name:
        return attParserV660.parse(attdata);

      case attParserLegacy.name:
      default:
        return attParserLegacy.parse(attdata);  
    }
  }
*/
module.exports = class {

  decodeAttendanceData(attdata) {
    return attParserV660.myParse(attdata);
  }
  /**
   *
   * @param {(error: Error, data) => void} [cb]
   */
  getAttendance(cb) {
    this.reply_id++;

    const buf = createHeader(Commands.ATTLOG_RRQ, this.session_id, this.reply_id, '', this.connectionType);

    const ATTDATA_SIZE = 40;
    const TRIM_FIRST = 10;
    const TRIM_NEXT = this.connectionType === ConnectionTypes.UDP ? 8 : 0;

    let state = States.FIRST_PACKET;
    let total_bytes = 0;
    let attendancesBuffer = Buffer.from([]);

    const internalCallback = (err, data) => {
      this.socket.removeListener(this.DATA_EVENT, handleOnData);

      cb && cb(err, data);
    };

    /**
     *
     * @param {Buffer} reply
     */
    const handleOnData = reply => {

      switch (state) {
        case States.FIRST_PACKET:
          state = States.PACKET;

          reply = this.connectionType === ConnectionTypes.UDP ? reply : removeTcpHeader(reply);

          if (reply && reply.length) {
            const cmd = reply.readUInt16LE(0);
/*    
            console.log("cmd :");
            console.log(cmd);
*/
            if (cmd == Commands.ACK_ERROR) {
              internalCallback(new Error('ack error'));
              return;
            }

            total_bytes = reply.readUInt32LE(8) - 4;
            total_bytes += 2;
/*
            console.log("total_bytes :");
            console.log(total_bytes);
*/
            if (total_bytes <= 0) {
              internalCallback(new Error('zero'));
              return;
            }

            if (reply.length > 16) {
              handleOnData(reply.slice(16));
            }
          } else {
            internalCallback(new Error('zero length reply'));
            return;
          }

          break;

        case States.PACKET:
          if (attendancesBuffer.length == 0) {
            reply = this.connectionType === ConnectionTypes.UDP ? reply : removeTcpHeader(reply);
            reply = reply.slice(TRIM_FIRST);
          } else {
            reply = reply.slice(TRIM_NEXT);
          }

          reply = removeHeadersInMiddle(reply);

          attendancesBuffer = Buffer.concat([attendancesBuffer, reply]);
          //let tmpattbuf = attendancesBuffer;

          // TODO: if sizes are not the same we should throw an error. rigth know if they not match it simple hangs

          if (attendancesBuffer.length === total_bytes) {
            const atts = [];

           /* for (let i = 0; i < attendancesBuffer.length-2; i += ATTDATA_SIZE) {//attendancesBuffer.length - 2 //attendancesBuffer.length - 20
              const att = this.decodeAttendanceData(attendancesBuffer.slice(i, i + ATTDATA_SIZE));
              atts.push(att);
            }*/
            
            for (let i = 0; i < attendancesBuffer.length-2; i += 16) {
              const att = this.decodeAttendanceData(attendancesBuffer.slice(i, i + 16));
              atts.push(att);
            } 
/*
            var count=0;
            for (let k = 0; k < 16*Math.floor(tmpattbuf.length/16); k += 16) {
            var timestamp6  = timeParser.decode(tmpattbuf.readUInt32LE(6+k)).toString();    
            var inOut11 =  tmpattbuf.readUInt8(k+11);
            var uid2 = tmpattbuf.readUInt16LE(k+2);
            var id = parseInt(tmpattbuf.slice(k+4,k+8).toString("ascii").split('\0').shift());
           
            //console.log(uid);
            //console.log(tmpattbuf.readUInt16LE(k) +"   "+tmpattbuf.readUInt16LE(k+1) +"   "+tmpattbuf.readUInt16LE(k+2) +"   "+tmpattbuf.readUInt16LE(k+3) +"   "+tmpattbuf.readUInt16LE(k+4) +"   "+tmpattbuf.readUInt16LE(k+5) +"   "+tmpattbuf.readUInt16LE(k+6) +"   "+tmpattbuf.readUInt16LE(k+7) +"   "+tmpattbuf.readUInt16LE(k+8) +"   "+tmpattbuf.readUInt16LE(k+9) +"   "+tmpattbuf.readUInt16LE(k+10) +"   "+tmpattbuf.readUInt16LE(k+11) +"   "+tmpattbuf.readUInt16LE(k+12) +"   "+tmpattbuf.readUInt16LE(k+13) +"   "+tmpattbuf.readUInt16LE(k+14) +"   "+tmpattbuf.readUInt16LE(k+15));
            //console.log(tmpattbuf.readUInt32LE(k) +"   "+tmpattbuf.readUInt32LE(k+1) +"   "+tmpattbuf.readUInt32LE(k+2) +"   "+tmpattbuf.readUInt32LE(k+3) +"   "+tmpattbuf.readUInt32LE(k+4) +"   "+tmpattbuf.readUInt32LE(k+5) +"   "+tmpattbuf.readUInt32LE(k+6) +"   "+tmpattbuf.readUInt32LE(k+7) +"   "+tmpattbuf.readUInt32LE(k+8) +"   "+tmpattbuf.readUInt32LE(k+9) +"   "+tmpattbuf.readUInt32LE(k+10) +"   "+tmpattbuf.readUInt32LE(k+11) +"   "+tmpattbuf.readUInt32LE(k+12) +"   "+tmpattbuf.readUInt32LE(k+13) +"   "+tmpattbuf.readUInt32LE(k+14) +"   "+tmpattbuf.readUInt32LE(k+15));
            //console.log(tmpattbuf[k] +"   "+tmpattbuf[k+1] +"   "+tmpattbuf[k+2] +"   "+tmpattbuf[k+3] +"   "+tmpattbuf[k+4] +"   "+tmpattbuf[k+5] +"   "+tmpattbuf[k+6] +"   "+tmpattbuf[k+7] +"   "+tmpattbuf[k+8] +"   "+tmpattbuf[k+9] +"   "+tmpattbuf[k+10] +"   "+tmpattbuf[k+11] +"   "+tmpattbuf[k+12] +"   "+tmpattbuf[k+13] +"   "+tmpattbuf[k+14] +"   "+tmpattbuf[k+15]);
            
            console.log(timestamp6 + "   " + inOut11 + "   " + uid2 );
            count+=1;
            } 
            console.log("total records :"+ count);
*/
            internalCallback(null, atts);
            //const tmp = [];
            //internalCallback(null, tmp);
            return;
          }

          break;
      }
    };

    this.socket.on(this.DATA_EVENT, handleOnData);

    this.send(buf, 0, buf.length, err => {
      if (err) {
        internalCallback(err);
      }
    });
  }

  /**
   *
   * @param {(error?: Error) => void} [cb]
   */
  clearAttendanceLog(cb) {
    return this.executeCmd(Commands.CLEAR_ATTLOG, '', (err, ret) => {
      if (err) return cb(err);

      return cb(null);
    });
  }

  /**
   *
   * @param {(error: Error) => void} [cb]
   * @deprecated since version 0.2.0. Use getAttendance instead
   */
  getattendance(cb) {
    console.warn('getattendance() function will deprecated soon, please use getAttendance()');
    return this.getAttendance(cb);
  }
};

function removeHeadersInMiddle(reply) {
  let buf = Buffer.from(reply);

  while (true) {
    const headerIndex = buf.indexOf(Buffer.from([0x50, 0x50, 0x82, 0x7d]));

    if (headerIndex === -1) {
      break;
    }

    buf = Buffer.from([...buf.slice(0, headerIndex), ...buf.slice(headerIndex + 16)]);
  }

  return buf;
}
