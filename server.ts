const express = require('express');
const http = require('http');
const cors = require('cors');
const socketio = require('socket.io');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('./models/User.ts');
const Message = require('./models/Message.ts');
const Chat = require('./models/Chat.ts');

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.json());
const server = http.Server(app);
const io = socketio(server);

io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('userJoined', (name) => onUserJoined(name, socket));
  socket.on('message', (message) => onMessageReceived(message, socket));
  socket.on('createChat', (chat) => onCreateChat(chat));
  socket.on('removeChat', (id) => onRemoveChat(id));
  socket.on('removeMessage', (id) => onRemoveMessage(id));
  socket.on('updateMessage', (message) => onUpdateMessage(message));
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

// Event listeners.
async function onUserJoined(name, socket) {
  console.log('USER JOINED', name);
  if (!name) {
    console.log('No name');
    return;
  }
  try {
    // The userId is null for new users.
    const user = await User.findOne({ name });
    if (!user) {
      const newUser = new User({
        name,
      });
      const savedUser = await newUser.save();
      socket.join(savedUser._id);
    } else {
      socket.join(name);
    }
    await _sendExistingChats(socket);
  } catch (err) {
    console.log(err);
  }
}

async function onCreateChat(chat) {
  if (chat) {
    const user = await User.findOne({ name: chat.userName });
    const newChat = new Chat({
      name: chat.name,
      author: user._id,
    });
    await newChat.save();
    await _sendExistingChats(io);
  }
}

async function onRemoveChat(id) {
  if (id) {
    await Chat.deleteOne({ _id: id });
    await _sendExistingChats(io);
  }
}

async function onRemoveMessage(id) {
  if (id) {
    const msg = await Message.findOne({ _id: id });
    if (msg) {
      await Chat.findOneAndUpdate(
        { _id: msg.chatId },
        { $pull: { messages: id } }
      );
      await Message.deleteOne({ _id: id });
      await _sendExistingChats(io);
    }
  }
}

async function onUpdateMessage(message) {
  if (message.message)
    await Message.findOneAndUpdate(
      { _id: message.message._id },
      { text: message.text }
    );
  await _sendExistingChats(io);
}

async function onMessageReceived(message, senderSocket) {
  console.log('message - ', message.text, message.name, message.chatId);
  const newMessage = await _saveMessage(message);
  await _sendAndUpdateChat(message.chatId, newMessage, senderSocket);
}

// Helper functions.
async function _sendExistingChats(socket) {
  const chats = await Chat.find()
    .populate({
      path: 'messages',
      populate: {
        path: 'user',
        model: 'User',
      },
    })
    .populate('author');
  if (!chats.length) {
    console.log('CHATS EMPTY', chats);
  }
  socket.emit('getChats', chats);
}

async function _saveMessage(message) {
  const user = await User.findOne({ name: message.name });
  const messageData = new Message({
    text: message.text,
    user: user._id,
    chatId: message.chatId,
  });
  return await messageData.save();
}

async function _sendAndUpdateChat(id, newMessage, socket) {
  await Chat.findOneAndUpdate(
    { _id: id },
    { $push: { messages: newMessage._id } }
  );
  await _sendExistingChats(io);
}

// server function
async function start() {
  try {
    await mongoose
      .connect(process.env.MONGODB_KEY, {
        useNewUrlParser: true,
      })
      .then(() => console.log('DB Connection Successfull!'))
      .catch((err) => {
        console.log(err);
      });

    server.listen(PORT, () => {
      console.log(`🚀 Server has been started on port: ${PORT}`);
    });
  } catch (e) {
    console.log(e);
  }
}

start();
