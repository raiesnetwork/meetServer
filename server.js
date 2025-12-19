import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import MeetLink from "./Models/MeetLink.js";
import Participant from "./Models/ParticipentScheema.js";
import morgan from "morgan";
import authMiddleware from "./Helpers/AuthMiddleware.js";
import { configDotenv } from "dotenv";
import recordingRours from './controlers/recordingController.js'
import videoCall from './controlers/VideoCallController.js'
import setupVideoCall from "./Helpers/VideocallSocket.js";
import voiceCallRoutes from './controlers/voiceCallRoutes.js';
import setupVoiceCall from "./Helpers/VoiceCallSocket.js";
import { error } from "console";
configDotenv()
const pendingRequests = new Map();
const chatHistory = new Map();
// meetingId => Map<userId, socketId>
const activeMeetingUsers = new Map();

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;

// ✅ Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: [
      "https://meet.ixes.ai",
      "https://ixes.ai",
      "http://localhost:5173",
      "http://localhost:8000"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  path: "/socket.io", 
});
setupVideoCall(io)
setupVoiceCall(io)
const userSockets = new Map();
const hostSockets = new Map(); 

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));
app.use('/',recordingRours)
app.use('/api/videocall',videoCall)
app.use('/api/voicecall', voiceCallRoutes);

mongoose
  .connect(process.env.DATABASE_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB Error:", err));

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-user", (userId) => {
    userSockets.set(userId, socket.id);
    socket.userId = userId;
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  socket.on("join-meeting-host", async (meetingId, userId) => {
    try {
      console.log(meetingId,userId,'join j=host');
      
      const meet = await MeetLink.findOne({ linkId: meetingId });
      console.log('join j=host');
      if (meet && meet.hostId.toString() === userId.toString()) {
        hostSockets.set(meetingId, socket.id);
        socket.meetingId = meetingId;
        socket.join(meetingId);
        console.log(`Host ${userId} joined meeting ${meetingId}`);
        
        const requests = getPendingRequestsForMeeting(meetingId);
        socket.emit("pending-requests-update", requests);
      }
    } catch (error) {
      console.error("Error joining meeting as host:", error);
    }
  });
// NEW  UPDATION
  socket.on("meeting-joined", ({ meetingId, userId }) => {
    if (!activeMeetingUsers.has(meetingId)) {
      activeMeetingUsers.set(meetingId, new Map());
    }

    activeMeetingUsers.get(meetingId).set(userId, socket.id);

    socket.meetingId = meetingId;
    socket.userId = userId;
  });
  // socket.on("join-request", async (data) => {
  //   const { name, meetingId, userId } = data;
  //   if (!activeMeetingUsers.has(meetingId)) {
  //     activeMeetingUsers.set(meetingId, new Map());
  //   }
  //   const meetingUsers = activeMeetingUsers.get(meetingId);
  //   if (meetingUsers.has(userId)) {
  //     socket.emit("join-error", {
  //       message: "This account is already active in the meeting."
  //     });
  //     return;
  //   }
  //   meetingUsers.set(userId, socket.id);
  //   socket.meetingId = meetingId;
  //   socket.userId = userId;
  //   socket.join(meetingId)
  //   try {
  //     const meet = await MeetLink.findOne({ linkId: meetingId });
  //     if (!meet) return;

  //     const requestId = `${meetingId}-${userId}`;
  //     if (pendingRequests.has(requestId)) {
  //       console.log("Join request already pending:", requestId);
  //       return;
  //     }
  //     pendingRequests.set(requestId, {
  //       id: requestId,
  //       name,
  //       userId,
  //       meetingId,
  //       timestamp: Date.now()
  //     });

  //     const hostSocketId = hostSockets.get(meetingId);
  //     console.log(hostSocketId,'hostSocketId');
      
  //     if (hostSocketId) {
  //       io.to(hostSocketId).emit("new-join-request", {
  //         id: requestId,
  //         name,
  //         userId,
  //         meetingId,
  //         timestamp: Date.now()
  //       });
  //     }

  //     console.log(`Join request from ${name} for meeting ${meetingId}`);
  //   } catch (error) {
  //     console.error("Error handling join request:", error);
  //   }
  // });

  socket.on("approve-participant", async (requestId) => {
    try {
      const request = pendingRequests.get(requestId);
      if (!request) return;

      const { userId, meetingId } = request;
      
      pendingRequests.delete(requestId);

      const userSocketId = userSockets.get(userId);
      if (userSocketId) {
        io.to(`user-${userId}`).emit("join-approved", { meetingId });
      }

      io.to(meetingId).emit("participant-approved", requestId);

      console.log(`Participant ${request.name} approved for meeting ${meetingId}`);
    } catch (error) {
      console.error("Error approving participant:", error);
    }
  });

  socket.on("reject-participant", (requestId) => {
    try {
      const request = pendingRequests.get(requestId);
      if (!request) return;

      const { userId, meetingId } = request;
      
      pendingRequests.delete(requestId);

      const userSocketId = userSockets.get(userId);
      if (userSocketId) {
        io.to(`user-${userId}`).emit("join-rejected", { meetingId });
      }

      io.to(meetingId).emit("participant-rejected", requestId);

      console.log(`Participant ${request.name} rejected for meeting ${meetingId}`);
    } catch (error) {
      console.error("Error rejecting participant:", error);
    }
  });

  socket.on("cancel-join-request", (data) => {
    const { meetingId, userId } = data;
    
    try {
      const requestId = `${meetingId}-${userId}`;
      
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        
        const hostSocketId = hostSockets.get(meetingId);
        console.log('hostSocketId',hostSocketId);
        
        if (hostSocketId) {
          io.to(hostSocketId).emit("participant-cancelled", requestId);
        }
        
        console.log(`Join request cancelled by user ${userId} for meeting ${meetingId}`);
      }
    } catch (error) {
      console.error("Error cancelling join request:", error);
    }
  });
// When host starts or stops recording
// socket.on("recording-state-changed", ({ meetingId, isRecording }) => {
//   console.log('rec',meetingId, isRecording);
  
//   io.to(meetingId).emit("update-recording-state", { isRecording });
// });
const addMessageToChatHistory = (meetingId, message) => {
  if (!chatHistory.has(meetingId)) {
    chatHistory.set(meetingId, []);
  }
  const messages = chatHistory.get(meetingId);
  messages.push({
    ...message,
    id: message.id || Date.now().toString(),
    timestamp: message.timestamp || Date.now()
  });
  
  // Limit chat history to last 100 messages per meeting
  if (messages.length > 100) {
    messages.shift();
  }
  
  chatHistory.set(meetingId, messages);
};
const getChatHistory = (meetingId) => {
  return chatHistory.get(meetingId) || [];cleanupChatHistory
};

const removeChatHistory = (meetingId) => {
  chatHistory.delete(meetingId);
};
socket.on('join-chat', (data) => {
  const { meetingId, userId, username } = data;
  socket.join(`chat-${meetingId}`);
  
  socket.to(`chat-${meetingId}`).emit('user-joined', { username });
});

socket.on('send-message', (messageData) => {
  const { meetingId, ...message } = messageData;
  
  addMessageToChatHistory(meetingId, message);
  
  io.to(`chat-${meetingId}`).emit('new-message', message);
});

socket.on('get-chat-history', (meetingId) => {
  const messages = getChatHistory(meetingId);
  socket.emit('chat-history', messages);
});



function cleanupChatHistory(meetingId) {
  removeChatHistory(meetingId);
}


  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    if (socket.meetingId && socket.userId) {
      const meetingUsers = activeMeetingUsers.get(socket.meetingId);
  
      if (meetingUsers) {
        meetingUsers.delete(socket.userId);
  
        if (meetingUsers.size === 0) {
          activeMeetingUsers.delete(socket.meetingId);
          cleanupChatHistory(socket.meetingId);
        }
      }
    }
    if (socket.userId) {
      userSockets.delete(socket.userId);
    }
    
    if (socket.meetingId) {
      hostSockets.delete(socket.meetingId);
      const room = io.sockets.adapter.rooms.get(socket.meetingId);
    if (!room || room.size === 0) {
      console.log(`All users disconnected from meeting ${socket.meetingId}. Cleaning up chat history...`);
      cleanupChatHistory(socket.meetingId);
    }
    }
  });
});

function getPendingRequestsForMeeting(meetingId) {
  const requests = [];
  for (const [key, value] of pendingRequests.entries()) {
    if (key.startsWith(meetingId)) {
      requests.push(value);
    }
  }
  return requests;
}

const createToken = async (participantName, roomId, isAdmin = false,userId) => {
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: userId.toString(),
      ttl: "10m",
      name:participantName
    }
  );
  at.addGrant({ roomJoin: true, room: roomId, roomAdmin: isAdmin, ingressAdmin: isAdmin });
  return await at.toJwt();
};

app.get("/get-token", authMiddleware, async (req, res) => {
  const { name, meetingId, userId } = req.query;

  const meet = await MeetLink.findOne({ linkId: meetingId });
  if (!meet)
    return res.status(404).json({ error: true, message: "Meeting not found" });
  if (!activeMeetingUsers.has(meetingId)) {
    activeMeetingUsers.set(meetingId, new Map());
  }

  const meetingUsers = activeMeetingUsers.get(meetingId);

  // 🚫 BLOCK duplicate login
  if (meetingUsers.has(userId)) {
    return res.status(403).json({
      error: true,
      message: "This account is already active in the meeting from another device.",
    });
  }


  const isHost = meet?.hostId.toString() === userId.toString();
  const token = await createToken(name, meetingId, isHost,userId);

  res.status(200).json({ 
    token, 
    error: false, 
    isHost 
  });
});

app.post("/kick", authMiddleware, async (req, res) => {
  const svc = new RoomServiceClient(
    process.env.WS_SERVER,
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET
  );
  const { roomId, identity } = req.body;
  await svc.removeParticipant(roomId, identity);
  const meetingUsers = activeMeetingUsers.get(roomId);
  if (meetingUsers) {
    meetingUsers.delete(identity);

    if (meetingUsers.size === 0) {
      activeMeetingUsers.delete(roomId);
      cleanupChatHistory(roomId);
    }
  }
  res.json({ message: "Participant removed" });
});


app.post("/request-join", authMiddleware, async (req, res) => {
  const { name, meetingId, userId } = req.body;
console.log(name, meetingId, userId);

  try {
    const meet = await MeetLink.findOne({ linkId: meetingId });
    if (!meet) {
      return res.status(404).json({ 
        success: false, 
        message: "Meeting not found" 
      });
    }
    const meetingUsers = activeMeetingUsers.get(meetingId);

    // 🚫 User already active
    if (meetingUsers && meetingUsers.has(userId)) {
      return res.json({
        error: true,
        message: "This account is already joined from another device."
      });
    }
    
    const isHost = meet.hostId.toString() === userId.toString();
    
    if (isHost) {
      return res.status(200).json({ 
        error:false,
        success: true, 
        approved: true,
        isHost: true 
      });
    }

    const requestId = `${meetingId}-${userId}`;
    if (pendingRequests.has(requestId)) {
      return res.status(200).json({ success: true, approved: false, message: "Already requested" });
    }
    pendingRequests.set(requestId, {
      id: requestId,
      name,
      userId,
      meetingId,
      timestamp: Date.now()
    });

    const hostSocketId = hostSockets.get(meetingId);
    if (hostSocketId) {
      io.to(hostSocketId).emit("new-join-request", {
        id: requestId,
        name,
        userId,
        meetingId,
        timestamp: Date.now()
      });
    }

    res.status(200).json({ 
      success: true, 
      approved: false,
      message: "Join request sent to host" 
    });

  } catch (error) {
    console.error("Error in request-join:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
});
// NEW  UPDATION
app.post("/leave-meeting", authMiddleware, (req, res) => {
  const { meetingId, userId } = req.body;

  const meetingUsers = activeMeetingUsers.get(meetingId);
  if (meetingUsers) {
    meetingUsers.delete(userId);

    if (meetingUsers.size === 0) {
      activeMeetingUsers.delete(meetingId);
      cleanupChatHistory(meetingId);
    }
  }

  res.json({ success: true });
});


server.listen(port, () => console.log(`Server running on port ${port}`));

export {io}