const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// ✅ Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB (Atlas)"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// ✅ User Schema
const UserSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String }
});
const User = mongoose.model("User", UserSchema);

// ✅ Temporary storage for OTPs
const otpStorage = {};

// ✅ Nodemailer Configuration for OTP
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL, pass: process.env.PASSWORD }
});

// ✅ Send OTP
app.post("/send-otp", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStorage[email] = otp;

    try {
        await transporter.sendMail({
            from: process.env.EMAIL,
            to: email,
            subject: "Your OTP Code",
            text: `Your OTP is: ${otp}`,
        });
        res.json({ success: true, message: "OTP sent successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to send OTP" });
    }
});

// ✅ Verify OTP
app.post("/verify-otp", (req, res) => {
    const { email, otp } = req.body;
    if (otpStorage[email] && otpStorage[email] == otp) {
        res.json({ success: true, message: "OTP Verified. Set your password now." });
    } else {
        res.json({ success: false, message: "Invalid OTP" });
    }
});

// ✅ Set Password After OTP Verification
app.post("/set-password", async (req, res) => {
    const { email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.updateOne({ email }, { $set: { password: hashedPassword } }, { upsert: true });
        res.json({ success: true, message: "Password set successfully" });
    } catch (error) {
        res.json({ success: false, message: "Error saving password" });
    }
});

// ✅ Login User
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && await bcrypt.compare(password, user.password)) {
        res.json({ success: true, userId: email,message: "✅ Login successful" });
    } else {
        res.json({ success: false, message: "❌ Invalid credentials" });
    }
});


// Add this to your server code
const GoalSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    targetDate: { type: Date },
    category: { type: String, default: 'health' },
    priority: { type: String, default: 'medium' },
    progress: { type: Number, default: 0 },
    status: { type: String, default: 'active' },
    createdAt: { type: Date, default: Date.now }
});
const Goal = mongoose.model("Goal", GoalSchema);
// ✅ Health Metrics Schema
const MetricSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    weight: { type: Number, required: true },
    height: { type: Number, required: true },
    bmi: { type: Number, required: true },
    steps: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Metric = mongoose.model("Metric", MetricSchema);



app.post("/save-metrics", async (req, res) => {
    const { userId, weight, height, bmi, steps } = req.body;

    if (!userId || !weight || !height || !bmi || !steps) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    try {
        const metric = new Metric({ userId, weight, height, bmi, steps });
        await metric.save();
        res.json({ success: true, message: "Metrics saved successfully!", data: metric });
    } catch (error) {
        console.error("❌ Error Saving Metrics:", error);
        res.status(500).json({ success: false, message: "Error saving metrics", error });
    }
});


// ✅ Get Metrics for a Specific User
app.get("/get-metrics", async (req, res) => {
    const { userId } = req.query; // userId will now be the email

    if (!userId) {
        return res.status(400).json({ success: false, message: "User email is required" });
    }

    try {
        const metrics = await Metric.find({ userId }).sort({ createdAt: -1 });
        res.json(metrics);
    } catch (error) {
        console.error("❌ Error Fetching Metrics:", error);
        res.status(500).json({ success: false, message: "Error fetching metrics" });
    }
});
// Update Goal Progress Route
app.put("/update-goal/:id", async (req, res) => {
    const { id } = req.params;
    const { progressAmount } = req.body;

    try {
        const goal = await Goal.findOneAndUpdate(
            { _id: id },
            { $inc: { progress: progressAmount } },
            { new: true }
        );
        
        if (!goal) {
            return res.status(404).json({ success: false, message: "Goal not found" });
        }

        res.json({ success: true, message: "Progress updated successfully", data: goal });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error updating progress" });
    }
});

// ✅ Delete a Metric Entry
app.delete("/delete-metric/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const deletedMetric = await Metric.findByIdAndDelete(id);
        if (!deletedMetric) {
            return res.status(404).json({ success: false, message: "Metric not found" });
        }
        res.json({ success: true, message: "Metric deleted successfully" });
    } catch (error) {
        console.error("❌ Error Deleting Metric:", error);
        res.status(500).json({ success: false, message: "Error deleting metric" });
    }
});

app.post("/add-goal", async (req, res) => {
    const { userId, title, description, targetDate, category, priority } = req.body;

    if (!userId || !title) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    try {
        const goal = new Goal({
            userId,
            title,
            description,
            targetDate,
            category,
            priority
        });
        await goal.save();
        res.json({ success: true, message: "Goal added successfully", data: goal });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error saving goal" });
    }
});

app.get("/get-goals", async (req, res) => {
    const { userId } = req.query; // userId is the user's email

    try {
        const goals = await Goal.find({ userId });
        res.json(goals);
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching goals" });
    }
});

app.delete("/delete-goal/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const deletedGoal = await Goal.findByIdAndDelete(id);
        if (!deletedGoal) {
            return res.status(404).json({ success: false, message: "Goal not found" });
        }
        res.json({ success: true, message: "Goal deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error deleting goal" });
    }
});
// Profile schema
const profileSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    name: String,
    phone: String
  });
  
  const Profile = mongoose.model('Profile', profileSchema);
  
  // Routes
  app.get('/api/profiles', async (req, res) => {
    const email = req.query.email;
    const profile = await Profile.findOne({ email });
    res.json({ name: profile?.name || '', phone: profile?.phone || '' });
  });
  
  app.post('/api/profiles', async (req, res) => {
    const { email, name, phone } = req.body;
    await Profile.findOneAndUpdate(
      { email },
      { name, phone },
      { upsert: true, new: true }
    );
    res.sendStatus(200);
});
app.post("/get-ai-recommendation", async (req, res) => {
    const { prompt } = req.body;
    const cohereApiKey = "fZi0aneLzH5QlKKQExUBos4jJfTJwM6iE3ELwucf"; // Replace with your actual Cohere API key

    try {
        const response = await axios.post(
            "https://api.cohere.ai/v1/generate",
            {
                prompt,
                max_tokens: 300,
                model: "command-xlarge-nightly",
                temperature: 0.7,
                stop_sequences: ["--"]
            },
            {
                headers: {
                    "Authorization": `Bearer ${cohereApiKey}`,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Cohere-Version": "2022-12-06",
                }
            }
        );

        res.json({ reply: response.data.generations[0].text });
    } catch (error) {
        console.error("AI API Error:", error);
        res.status(500).json({ error: "Error generating recommendations" });
    }
});

mongoose.connection.on("connected", () => console.log("✅ MongoDB Connected"));
mongoose.connection.on("error", (err) => console.error("❌ MongoDB Error:", err));


// ✅ Start Server
app.listen(PORT, () => console.log(`🚀 Server running on http://127.0.0.1:${PORT}`));
