const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);
const path = require('path');

const PORT = process.env.PORT || 3000;
app.use(express.static('public'));

const rooms = {};

app.get('/room/:roomName', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  socket.on('join-room', ({ room, username, avatar, topic, password }) => {
    if (!rooms[room]) {
      rooms[room] = {
        users: {},
        topic: topic || 'Chat Room',
        password: password || '',
        isPrivate: !!password,
      };
    }

    if (rooms[room].password && rooms[room].password !== password) {
      socket.emit('room-error', 'Invalid password');
      return;
    }

    const color = `hsl(${Math.floor(Math.random() * 360)}, 70%, 70%)`;
    rooms[room].users[socket.id] = { username, color, avatar };
    socket.join(room);

    socket.emit('room-data', {
      room,
      topic: rooms[room].topic,
      isPrivate: rooms[room].isPrivate,
      users: Object.values(rooms[room].users),
    });

    socket.broadcast.to(room).emit('user-joined', `${username} joined the room`);
    io.to(room).emit('update-participants', Object.values(rooms[room].users));

    socket.on('chat-message', (msg) => {
      const user = rooms[room].users[socket.id];
      const timestamp = new Date().toLocaleTimeString();
      io.to(room).emit('chat-message', { msg, username: user.username, timestamp, color: user.color, avatar: user.avatar });
    });

    socket.on('image-message', ({ imgData, filename }) => {
      const user = rooms[room].users[socket.id];
      const timestamp = new Date().toLocaleTimeString();
      io.to(room).emit('image-message', { imgData, filename, username: user.username, timestamp, color: user.color, avatar: user.avatar });
    });

    socket.on('disconnect', () => {
      if (rooms[room]?.users[socket.id]) {
        const user = rooms[room].users[socket.id];
        delete rooms[room].users[socket.id];
        io.to(room).emit('user-left', `${user.username} left the room`);
        io.to(room).emit('update-participants', Object.values(rooms[room].users));
        if (Object.keys(rooms[room].users).length === 0) delete rooms[room];
      }
    });
  });
});

http.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
