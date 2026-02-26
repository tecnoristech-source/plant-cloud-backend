// ===============================
// PLANT CLOUD BACKEND - FINAL CLEAN VERSION
// ===============================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// ===============================
// HEALTH ROUTE (VERY IMPORTANT)
// ===============================
app.get("/", (req, res) => {
  res.send("Plant Cloud Backend Running 🚀");
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Backend Working",
    timestamp: new Date()
  });
});

// ===============================
// SIMPLE USER STORAGE (JSON FILE)
// ===============================

const USERS_FILE = path.join(__dirname, "users.json");

if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, "[]");
}

// Signup
app.post("/api/signup", (req, res) => {
  const { email, password } = req.body;

  const users = JSON.parse(fs.readFileSync(USERS_FILE));

  const userExists = users.find(u => u.email === email);

  if (userExists) {
    return res.status(400).json({ message: "User already exists" });
  }

  users.push({ email, password });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

  res.json({ message: "Signup successful" });
});

// Login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const users = JSON.parse(fs.readFileSync(USERS_FILE));

  const user = users.find(
    u => u.email === email && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  res.json({ message: "Login successful" });
});

// ===============================
// DEVICE ROUTE
// ===============================
app.get("/api/device/:id", (req, res) => {
  res.json({
    deviceId: req.params.id,
    status: "online",
    pump: "OFF"
  });
});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
