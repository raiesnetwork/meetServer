import serviceAccount from "./firebase-service.json" assert { type: "json" };
import userScheema from "../Models/UserSchema.js";
import { admin } from "./fcmprovaider.js";
// import { sendIosVoipPush } from "./sendIosVoipPush.js";


const userSocketMap = {}; // userId => socketId
const busyUsers = {};      // userId → true/false

export default function setupVoiceCall(io) {
  const voiceIO = io.of('/voicecall');
  
  voiceIO.on("connection", (socket) => {
    console.log("VoiceCall socket connected:", socket.id);

    socket.on("register-user", (userId) => {
      userSocketMap[userId] = socket.id;
      socket.userId = userId;
      console.log("User registered for voice calls:", userId, socket.id);
    });

    socket.on("user-busy-voice", (data, callback) => {
      const { receiverId } = data;
      const receiverBusy = !!busyUsers[receiverId];

      console.log("Voice busy check:", receiverId, "->", receiverBusy);

      if (receiverBusy) {
        callback({
          busy: true,
          message: "User is currently in another call"
        });
      } else {
        callback({
          busy: false,
          message: "User is free to receive call"
        });
      }
    });

    socket.on("initiate-voice-call", async(data) => {
      const { roomName, callerId, callerName, receiverId, isConference } = data;
      
      const receiverSocket = userSocketMap[receiverId];

      // if (!receiverSocket) {
      //   socket.emit("user-offline-voice", "User is offline");
      //   return;
      // }
if (receiverSocket) {


      busyUsers[callerId] = true;
      busyUsers[receiverId] = true;

      voiceIO.to(receiverSocket).emit("incoming-voice-call", {
        roomName,
        callerName,
        callerId,
        isConference: isConference || false
      });

      console.log("Incoming voice call sent to:", receiverId, "Room:", roomName);
      return
    }
      const receiver = await userScheema.findById(receiverId);
      if (!receiver?.fcmToken) {
        socket.emit("user-offline-voice", "User is offline");
                return;
      }
      if (receiver.platform==='android') {
        
      
      busyUsers[callerId] = true;
      busyUsers[receiverId] = true;

      await admin.messaging().send({
        token: receiver.fcmToken,
        notification: {
          title: "Incoming Voice Call",
          body: `${callerName} is calling you`,
        },
        data: {
          type: "voice_call",
          roomName,
          callerId,
          callerName,
        },
        android: {
          priority: "high",
        },
        apns: {
          payload: {
            aps: {
              "content-available": 1
            }
          }
        }
      });
      }
      // if (receiver.platform === "ios" && receiver.voipToken) {
      //   await sendIosVoipPush({
      //     voipToken: receiver.voipToken,
      //     roomName,
      //     callerId,
      //     callerName,
      //     callType: "voice_call",
      //   });
      // }
      console.log("Push sent for incoming call");
    
    });

    socket.on("call-accepted-voice", (data) => {
      const { receiverId, isConference } = data;
      const callerSocket = userSocketMap[receiverId];

      if (callerSocket) {
        voiceIO.to(callerSocket).emit("call-accepted-voice", {
          message: "Call accepted",
          isConference: isConference || false
        });
        console.log("Voice call accepted by receiver");
      }
    });

    socket.on("voice-call-ended", (data) => {
      const { receiverId, receiverName, callerName, callerId } = data;
      const receiverSocket = userSocketMap[receiverId];

      delete busyUsers[callerId];
      

      if (receiverSocket) {
        voiceIO.to(receiverSocket).emit("voice-call-ended", {
          receiverId: callerId,
          receiverName: callerName
        });
      }

      socket.broadcast.emit("participant-left-voice-call", {
        participantId: callerId
      });

      console.log("Voice call ended for:", receiverId || "conference");
    });

    socket.on("call-rejected-voice", (data) => {
      const { callerId, receiverName ,currentUserId} = data;
      const callerSocket = userSocketMap[callerId];
        console.log(busyUsers[callerId]);
        
        busyUsers[callerId]=false
        busyUsers[currentUserId]=false
        console.log(busyUsers[callerId],callerId);
     

      if (callerSocket) {
        voiceIO.to(callerSocket).emit("call-rejected-voice", {
          message: `${receiverName} rejected your call`
        });
      }
    });

    socket.on("invite-to-voice-call", (data) => {
      const { roomName, callerId, callerName, receiverId, receiverName } = data;

      const receiverSocket = userSocketMap[receiverId];

      if (!receiverSocket) {
        socket.emit("user-offline-voice", `${receiverName} is offline`);
        return;
      }

      busyUsers[receiverId] = true;

      voiceIO.to(receiverSocket).emit("new-participant-invited-voice", {
        roomName,
        callerName,
        callerId
      });

      console.log(`Invited ${receiverId} to voice room ${roomName}`);
    });

    socket.on("participant-joined-voice-call", (data) => {
      const { participantId, participantName, roomName } = data;
      
      socket.broadcast.emit("participant-joined-voice-call", {
        participantId,
        participantName
      });

      console.log(`Participant ${participantName} joined voice call ${roomName}`);
    });

    socket.on("participant-left-voice-call", (data) => {
      const { participantId } = data;
      
      delete busyUsers[participantId];

      socket.broadcast.emit("participant-left-voice-call", {
        participantId
      });

      console.log(`Participant ${participantId} left voice call`);
    });

    socket.on("disconnect", () => {
      console.log("VoiceCall socket disconnected:", socket.id);
      
      for (const [userId, sockId] of Object.entries(userSocketMap)) {
        if (sockId === socket.id) {
          delete userSocketMap[userId];
          delete busyUsers[userId];
          
          socket.broadcast.emit("participant-left-voice-call", {
            participantId: userId
          });
          
          console.log("User cleaned up from voice calls:", userId);
          break;
        }
      }
    });
  });
}