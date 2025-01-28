const express = require("express");
const http = require("http");
const cors = require("cors");
const socketIO = require("socket.io");
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 5000;

// Store active rooms and their participants
const rooms = new Map();

app.use(cors());

app.get("/", (req, res) => {
  res.send("WebRTC Signaling Server is running");
});

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  // Send socket ID to client
  socket.emit("connected", {
    socketId: socket.id
  });

  // Handle room creation
  socket.on("createRoom", () => {
    const roomId = uuidv4();
    rooms.set(roomId, new Set([socket.id]));
    socket.join(roomId);
    socket.emit("roomCreated", { roomId });
  });

  // Handle room joining
  socket.on("joinRoom", ({ roomId }) => {
    if (!rooms.has(roomId)) {
      socket.emit("error", { message: "Room does not exist" });
      return;
    }

    const room = rooms.get(roomId);
    if (room.size >= 2) {
      socket.emit("error", { message: "Room is full" });
      return;
    }

    room.add(socket.id);
    socket.join(roomId);
    socket.emit("roomJoined", { roomId });

    // Notify other participants
    socket.to(roomId).emit("peerConnected", {
      peerId: socket.id
    });
  });

  // Handle WebRTC signaling

  // Step 1: Offer creation
  socket.on("offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("offer", {
      offer,
      offerId: socket.id
    });
  });

  // Step 2: Answer creation
  socket.on("answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("answer", {
      answer,
      answerId: socket.id
    });
  });

  // Step 3: ICE candidate exchange
  socket.on("iceCandidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("iceCandidate", {
      candidate,
      candidateId: socket.id
    });
  });

  // Handle media status changes
  socket.on("mediaStatusChange", ({ roomId, mediaType, isEnabled }) => {
    socket.to(roomId).emit("peerMediaStatusChanged", {
      peerId: socket.id,
      mediaType,
      isEnabled
    });
  });

  // Handle messages
  socket.on("message", ({ roomId, message }) => {
    socket.to(roomId).emit("message", {
      senderId: socket.id,
      message,
      timestamp: Date.now()
    });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    // Remove user from all rooms they're in
    rooms.forEach((participants, roomId) => {
      if (participants.has(socket.id)) {
        participants.delete(socket.id);
        
        // Notify other participants
        socket.to(roomId).emit("peerDisconnected", {
          peerId: socket.id
        });

        // Remove room if empty
        if (participants.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });

  // Handle explicit room leaving
  socket.on("leaveRoom", ({ roomId }) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.delete(socket.id);
      socket.leave(roomId);

      // Notify other participants
      socket.to(roomId).emit("peerLeft", {
        peerId: socket.id
      });

      // Remove room if empty
      if (room.size === 0) {
        rooms.delete(roomId);
      }
    }
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
