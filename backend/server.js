import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import { ExpressPeerServer } from 'peer';
import http from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();

app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch((error) => console.error('MongoDB connection error:', error));

// Routes
app.use('/api', authRoutes);
app.use('/api', sessionRoutes);

// Error handling
app.use((req, res, next) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// only start the server if not running tests
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const peerServer = ExpressPeerServer(server, {
    debug: true,
    path: '/peerjs'
  });
  app.use('/peerjs', peerServer);
}

io.on("connection", (socket) => {
  socket.on("join_session", (sessionId, id, username) => {
    socket.join(sessionId);
    socket.to(sessionId).emit("user_connection", id, username);

    socket.on("leave_session", () => {
      socket.to(sessionId).emit("user_disconnection", id);
      socket.leave(sessionId);
    });
  });
});

server.listen(3030);
// export the app for testing
export default app;
