const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ChatSchema = new Schema(
  {
    name: { type: String, required: true },
    messages: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

const Chat = mongoose.model('Chat', ChatSchema);
module.exports = Chat;
