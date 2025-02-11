require("dotenv").config();
const config = require("./config.json");
const mongoose = require("mongoose");
const express = require("express");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const User = require("./models/user.model.js");
const Note = require("./models/note.model.js");
const { authenticateToken } = require("./utilities.js");


const app = express();

app.use(express.json());
app.use(cors()); 
 // Restrict to specific origins

mongoose
  .connect(config.connectionString)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.get("/", (req, res) => {
  res.json({ data: "Hello" });
});

app.post("/create-account", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res
        .status(400)
        .json({ error: true, message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        error: true,
        message: "A user with this email address already exists.",
      });
    }

    

    const hashedPassword = await bcrypt.hash(password, 10);
     const user = new User({ fullName, email, password: hashedPassword });
     const verificationToken = jwt.sign(
       { email, id: user._id, type: "verification" }, // Include user ID here
       process.env.ACCESS_TOKEN_SECRET,
       { expiresIn: "1h" }
     );

     const sendVerificationEmail = (email, token) => {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "gashawkalkidan700@gmail.com",
          pass: "kayj imyo vtyo spli",
        },
      });
      
       const verificationLink = `https://frontednote.onrender.com/verify/?token=${token}`;
     
       const mailOptions = {
         from: "gashawkalkidan700@gmail.com",
         to: email,
         subject: "Email Verification",
         text: `Please verify your email by clicking this link: ${verificationLink}`,
       };
     
       transporter.sendMail(mailOptions, (error, info) => {
         if (error) {
           console.log("Error sending email: ", error);
         } else {
           console.log("Verification email sent: ", info.response);
         }
       });
     };


   

    await user.save();
    
    sendVerificationEmail(email, verificationToken);

    return res
      .status(201)
      .json({ message: "User registered. Verification email sent." });
  } catch (error) {
    console.error(error.message);
    res.status(500).send({ message: error.message });
  }
});
// Get user
app.get("/get-user", authenticateToken, async (req, res) => {
  const user = req.user;

  if (!user || !user.id) {
    return res
      .status(401)
      .json({ error: true, message: "Unauthorized: No user information" });
  }

  try {
    const isUser = await User.findOne({ _id: user.id });

    if (!isUser) {
      return res.status(404).json({ error: true, message: "User not found" });
    }

    return res.json({
      user: {
        fullName: isUser.fullName,
        email: isUser.email,
        _id: isUser._id,
      },
      message: "User retrieved successfully",
    });
  } catch (error) {
    console.error("Error retrieving user:", error);
    return res
      .status(500)
      .json({ error: true, message: "Internal server error" });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ error: true, message: "Email and password are required" });
  }

  const userInfo = await User.findOne({ email });
  if (!userInfo) {
    return res.status(400).json({ error: true, message: "User not found" });
  }
   if (!userInfo.isVerified) {
     return res
       .status(403)
       .json({ message: "Account not verified. Please verify your email." });
   }


  const passwordMatch = await bcrypt.compare(password, userInfo.password);
  if (passwordMatch) {
    const accessToken = jwt.sign(
      { id: userInfo._id, email: userInfo.email },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1h" }
    );

    return res.json({
      error: false,
      message: "Login successful",
      accessToken,
    });
  } else {
    return res
      .status(401)
      .json({ error: true, message: "Invalid credentials" });
  }
});

app.post("/add-note", authenticateToken, async (req, res) => {
  const { title, content, tags } = req.body;
  const user = req.user;

  console.log("Authenticated user:", user);

  if (!title || !content) {
    return res
      .status(400)
      .json({ error: true, message: "Title or content is missing" });
  }

  try {
    const note = new Note({
      title,
      content,
      tags: tags || [],
      userId: user.id,
    });

    await note.save();
    return res.status(201).json({
      error: false,
      note,
      message: "Note added successfully",
    });
  } catch (err) {
    console.error("Error adding note:", err);
    return res
      .status(500)
      .json({ error: true, message: "Internal server error" });
  }
});

app.put("/edit-note/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { title, content, tags } = req.body;
  const user = req.user;

  console.log("Current user ID:", user.id);

  if (!title && !content && !tags) {
    return res
      .status(400)
      .json({ error: true, message: "No changes provided" });
  }

  try {
    const note = await Note.findOne({ _id: noteId, userId: user.id });

    if (!note) {
      return res.status(404).json({ error: true, message: "Note not found" });
    }

    if (title) note.title = title;
    if (content) note.content = content;
    if (tags) note.tags = tags;

    await note.save();

    return res.json({
      error: false,
      note,
      message: "Note updated successfully",
    });
  } catch (err) {
    console.error("Error updating note:", err);
    return res
      .status(500)
      .json({ error: true, message: "Internal server error" });
  }
});

app.get("/get-all-notes", authenticateToken, async (req, res) => {
  const user = req.user;

  try {
    const notes = await Note.find({ userId: user.id });

    return res.json({
      error: false,
      count: notes.length,
      notes,
      message: "All notes retrieved successfully",
    });
  } catch (error) {
    console.error("Error retrieving notes:", error);
    return res
      .status(500)
      .json({ error: true, message: "Internal server error" });
  }
});

app.delete("/delete-note/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const user = req.user;

  try {
    const note = await Note.findOne({ _id: noteId, userId: user.id });

    if (!note) {
      return res.status(404).json({ error: true, message: "Note not found" });
    }

    await Note.deleteOne({ _id: noteId, userId: user.id });
    return res.json({
      error: false,
      message: "Note deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting note:", error);
    return res
      .status(500)
      .json({ error: true, message: "Internal server error" });
  }
});

app.get("/search-notes", authenticateToken, async (req, res) => {
  const user = req.user;
  const { query } = req.query;

  if (!query) {
    return res
      .status(400)
      .json({ error: true, message: "Search query is required" });
  }

  try {
    const matchingNotes = await Note.find({
      userId: user.id,
      $or: [
        { title: { $regex: new RegExp(query, "i") } },
        { content: { $regex: new RegExp(query, "i") } },
      ],
    });

    return res.json({
      error: false,
      notes: matchingNotes,
      message: "Notes matching the search query retrieved successfully",
    });
  } catch (error) {
    console.error("Error searching notes:", error);
    return res
      .status(500)
      .json({ error: true, message: "Internal server error" });
  }
});

app.get("/verify", async (req, res) => {
  try {
    const { token } = req.query; // Changed from accessToken to token

    // Verify the token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    if (decoded.type !== "verification") {
      return res.status(400).json({ message: "Invalid token type" });
    }

    const userId = decoded.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "User already verified" });
    }

    user.isVerified = true;
    await user.save();

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Verification error:", error.message);
    res.status(400).json({ message: "Invalid or expired token" });
  }
});

app.put("/update-note/:id", async (req, res) => {
  const { id } = req.params;
  const { title, content, tags, isFavorite } = req.body;

  try {
    const updatedNote = await Note.findByIdAndUpdate(
      id,
      {
        title,
        content,
        tags,
        isFavorite,
      },
      { new: true }
    );

    res.status(200).json({ note: updatedNote });
  } catch (error) {
    res.status(500).json({ message: "Error updating note" });
  }
});



app.listen(5557, () => {
  console.log("Server running on port 5557");
});

module.exports = app;
