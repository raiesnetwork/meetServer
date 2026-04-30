import serviceAccount from "./firebase-service.json" with { type: "json" };
import userScheema from "../Models/UserSchema.js";
import { admin } from "./fcmprovaider.js";
import { webPush } from "./webpush.js";
// import { sendIosVoipPush } from "./sendIosVoipPush.js";


const userSocketMap = {}; // userId => socketId
const busyUsers = {};      // userId → true (only set when busy, deleted when free)

export default function setupVoiceCall(io) {
  const voiceIO = io.of('/voicecall');
  
  voiceIO.on("connection", (socket) => {
    console.log("VoiceCall socket connected:", socket.id);

    socket.on("register-user", (userId) => {
      userSocketMap[userId] = socket.id;
      socket.userId = userId;
      console.log("User registered for voice calls:", userId, socket.id);
    });

    // ✅ Bug 1 fix: busyUsers only has keys when truly busy.
    // !!busyUsers[id] is true only when the key EXISTS and is true.
    // We DELETE the key when the user is free — never set to false.
    socket.on("user-busy-voice", (data, callback) => {
      const { receiverId } = data;
      const receiverBusy = busyUsers[receiverId] === true;

      console.log("Voice busy check:", receiverId, "->", receiverBusy);

      callback({
        busy: receiverBusy,
        message: receiverBusy
          ? "User is currently in another call"
          : "User is free to receive call"
      });
    });

    socket.on("initiate-voice-call", async(data) => {
      const { roomName, callerId, callerName, receiverId, isConference } = data;
      
      const receiverSocket = userSocketMap[receiverId];

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
        return;
      }

      const receiver = await userScheema.findById(receiverId);
      if (!receiver?.fcmToken) {
        socket.emit("user-offline-voice", "User is offline");
        return;
      }

      if (receiver.platform === 'android') {
        busyUsers[callerId] = true;
        busyUsers[receiverId] = true;

        await admin.messaging().send({
          token: receiver.fcmToken,
          data: {
            type: "voice_call",
            roomName: String(roomName),
            callerId: String(callerId),
            callerName: String(callerName),
            isConference: String(isConference ?? false)
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
        return;
      }

      // iOS VoIP push (uncomment when ready)
      // if (receiver.platform === "ios" && receiver.voipToken) {
      //   await sendIosVoipPush({ voipToken: receiver.voipToken, roomName, callerId, callerName, callType: "voice_call" });
      //   return;
      // }

      await webPush({
        fcmToken: receiver.fcmToken,
        roomName,
        callerId,
        callerName,
        callType: "voice_call",
        isConference
      });
      console.log("Push sent for incoming voice call");
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

    // ✅ Bug 3 fix: Removed socket.broadcast.emit("participant-left-voice-call") from here.
    // That broadcast caused Flutter to receive it and re-emit participant-left-voice-call
    // back to the server, which triggered Bug 2 (deleting userSocketMap entries) in a loop.
    // Now voice-call-ended ONLY notifies the other party directly — no broadcast.
    socket.on("voice-call-ended", (data) => {
      const { receiverId, receiverName, callerName, callerId } = data;
      const receiverSocket = userSocketMap[receiverId];

      // Free both users
      delete busyUsers[callerId];
      delete busyUsers[receiverId];

      if (receiverSocket) {
        voiceIO.to(receiverSocket).emit("voice-call-ended", {
          receiverId: callerId,
          receiverName: callerName
        });
      }

      console.log("Voice call ended for:", receiverId || "conference");
    });

    // ✅ Bug 1 fix: DELETE the busy flags instead of setting to false.
    // Setting busyUsers[x] = false leaves the key in the object.
    // !!false === false, so the busy check works, BUT the key's presence
    // can cause subtle issues. DELETE is the correct clean-up.
    socket.on("call-rejected-voice", (data) => {
      const { callerId, receiverName, currentUserId } = data;
      const callerSocket = userSocketMap[callerId];

      delete busyUsers[callerId];
      delete busyUsers[currentUserId];

      console.log("Voice call rejected — busy flags cleared for", callerId, currentUserId);

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

    // ✅ Bug 2 + Bug 3 fix:
    // OLD code did:
    //   delete userSocketMap[participantId]  ← made user unreachable after leaving
    //   socket.broadcast.emit(...)           ← caused Flutter to re-emit, feeding the loop
    //
    // NEW code: Only clears the busy flag. userSocketMap is NOT touched here
    // (the user is still connected — they just left this particular call).
    // No re-broadcast: Flutter should update its own local state on receipt of
    // voice-call-ended or participant-left-voice-call from the server directly.
    socket.on("participant-left-voice-call", (data) => {
      const { participantId } = data;

      // Only free the busy flag — do NOT delete from userSocketMap
      delete busyUsers[participantId];

      // ✅ No re-broadcast here — this breaks the chain reaction loop (Bug 3).
      // The client that sent this event already knows the participant left.
      // Other clients in the call will be notified via voice-call-ended or
      // the LiveKit room events directly.

      console.log(`Participant ${participantId} left voice call — busy flag cleared`);
    });

    socket.on("disconnect", () => {
      console.log("VoiceCall socket disconnected:", socket.id);
      
      for (const [userId, sockId] of Object.entries(userSocketMap)) {
        if (sockId === socket.id) {
          delete userSocketMap[userId];
          delete busyUsers[userId];
          
          // Notify others this user's socket dropped
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