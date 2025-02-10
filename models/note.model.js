const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const noteSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  tags: { type: [String], default: [] },
  userId: { type: String, required: true },
  createdOn: { type: Date, default: new Date().getTime() },
  isFavorite: { type: Boolean, default: false }, // Added isFavorite field
});

module.exports = mongoose.model("Note", noteSchema);
