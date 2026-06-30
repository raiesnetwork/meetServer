import serviceAccount from "./firebase-service.json" with { type: "json" };
import userScheema from "../Models/UserSchema.js";
import { admin } from "./fcmprovaider.js";
import { webPush } from "./webpush.js";
// import { sendIosVoipPush } from "./sendIosVoipPush.js";
import mongoose from "mongoose";
const userSocketMap = {}; // userId => socketId
const busyUsers = {};      // userId → true/false
const pendingCalls = {};   // callId -> { roomName, callerId, receiverId, createdAt }    // userId → true/false

export default function setupVideoCall(io) {
  const videoIO = io.of('/videocall');
  
  videoIO.on("connection", (socket) => {
    console.log("VideoCall socket connected:", socket.id);

    socket.on("register-user", (userId) => {
      userSocketMap[userId] = socket.id;
      console.log("User registered:", userId, socket.id);
    });

    socket.on("user-busy", (data, callback) => {
        const { receiverId } = data;
        // ✅ Bug 1 fix: use === true so only explicitly-set busy flags match
        const receiverBusy = busyUsers[receiverId] === true;
  
        console.log("Busy check:", receiverId, "->", receiverBusy);
  
        callback({
          busy: receiverBusy,
          message: receiverBusy
            ? "User is currently in another call"
            : "User is free to receive call"
        });
      });

    socket.on("initiate-video-call", async(data) => {
      const { roomName, callerId, callerName, receiverId } = data;
      
       const receiverSocket = userSocketMap[receiverId];

    const callId = new mongoose.Types.ObjectId().toString();

    pendingCalls[callId] = {
        roomName,
        callerId,
        receiverId,
        createdAt: Date.now(),
    };

      // if (!receiverSocket) {
      //   socket.emit("user-offline", "User is offline");
      //   return;
      // }
      if (receiverSocket) {
      busyUsers[callerId] = true;
      busyUsers[receiverId] = true;
      videoIO.to(receiverSocket).emit("incoming-video-call", {
        roomName,
        callerName,
        callerId,
            callId,
      });

      console.log("Incoming call sent to:", receiverId);
      return
    }
    const receiver = await userScheema.findById(receiverId);
    if (!receiver?.fcmToken) {
      socket.emit("user-offline", "User unavailable");
      return;
    }
   if(receiver.platform==='android'){
    busyUsers[callerId] = true;
    await admin.messaging().send({
      token: receiver.fcmToken,
    
      data: {
        type: "video_call",
        roomName: String(roomName),
    callId: String(callId),
    callerId: String(callerId),
    callerName: String(callerName),
      },
      android: {
        priority: "high",
        ttl: 30000,
        notification: {
          sound: "default", 
          channelId: "call_channel"
        }
      },
    });
    return
   }
  //  if (receiver.platform === "ios" && receiver.voipToken) {
  //   await sendIosVoipPush({
  //     voipToken: receiver.voipToken,
  //     roomName,
  //     callerId,
  //     callerName,
  //     callType: "video_call",
  //   });
  //return
  // }
  await webPush({
    fcmToken: receiver.fcmToken,
     roomName,
     callerId,
     callerName,
     callType: "video_call",
   })
    console.log("Push sent for incoming call");
  
    });
    
  socket.on("call-accepted", (data) => {
    const { callerId, callId } = data;
      const callerSocket = userSocketMap[callerId];
      delete pendingCalls[callId];
      busyUsers[socket.userId] = true;
      if (callerSocket) {
        videoIO.to(callerSocket).emit("call-accepted", {
          message: "Call accepted",
            callId,
        });
        console.log("Call accepted by receiver");
      }
    });

    
    socket.on("video-call-canceled", (data) => {
      const { receiverId, receiverName, callerName, callerId,        callId } = data;
      const receiverSocket = userSocketMap[receiverId];

      // ✅ Bug 1 fix: delete BOTH sides so neither is stuck as busy
      delete busyUsers[callerId];
      delete busyUsers[receiverId];
if (receiverSocket) {

    delete pendingCalls[callId];

    videoIO.to(receiverSocket).emit("video-call-ended", {
        receiverId: callerId,
        receiverName: callerName
    });

    return;
}

const callData = pendingCalls[callId];

if (callData) {

    const { roomName } = callData;

    delete pendingCalls[callId];

    const receiver = await userScheema.findById(receiverId);

    if (receiver?.fcmToken) {

        await admin.messaging().send({
            token: receiver.fcmToken,
            data: {
                type: "cancel_call",
                callId,
                roomName: String(roomName),
                callType: "video_call"
            }
        });

    }
}

      console.log("Video call cancelled — busy flags cleared for", callerId, receiverId);
    });

   
    socket.on("call-rejected", (data) => {
      const { callerId, receiverName, currentUserId,    callId} = data;
      const callerSocket = userSocketMap[callerId];

      // ✅ Bug 1 fix: clear busy flags for both parties on rejection
      delete busyUsers[callerId];
      delete busyUsers[currentUserId];
    delete pendingCalls[callId];

      if (callerSocket) {
        videoIO.to(callerSocket).emit("call-rejected", {
          message: `${receiverName} rejected your call`
        });
      }
    });

    
    socket.on("invite-to-call", (data) => {
      const { roomName, callerId, callerName, receiverId, receiverName } = data;

      const receiverSocket = userSocketMap[receiverId];

      if (!receiverSocket) {
        socket.emit("user-offline", `${receiverName} is offline`);
        return;
      }
      busyUsers[receiverId] = true;

      videoIO.to(receiverSocket).emit("incoming-video-call", {
        roomName,
        callerName,
        callerId
      });

      console.log(`Invited ${receiverId} to room ${roomName}`);
    });

    
    socket.on("participant-joined-call", (data) => {
      socket.broadcast.emit("participant-joined-call", data);
    });

    socket.on("participant-left-call", (data) => {
      socket.broadcast.emit("participant-left-call", data);
    });

    
    socket.on("disconnect", () => {
      console.log("VideoCall socket disconnected:", socket.id);
      for (const [userId, sockId] of Object.entries(userSocketMap)) {
        if (sockId === socket.id) {
          delete userSocketMap[userId];
          delete busyUsers[userId];
          break;
        }
      }
    });
  });
};