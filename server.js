const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mqtt = require("mqtt");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET = "supersecretkey";

app.use(cors());
app.use(bodyParser.json());

/* ===============================
   TEMP USER DATABASE (Replace with Mongo later)
================================= */

let users = [];

/* ===============================
   AUTH ROUTES
================================= */

app.post("/api/signup", async (req, res) => {
  const { email, password } = req.body;

  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ message: "User already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ email, password: hashedPassword });

  res.json({ message: "Signup successful" });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(400).json({ message: "User not found. Please sign up." });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(400).json({ message: "Invalid password" });
  }

  const token = jwt.sign({ email }, SECRET, { expiresIn: "1d" });

  res.json({ token });
});

/* ===============================
   PROTECT MIDDLEWARE
================================= */

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.sendStatus(401);

  const token = authHeader.split(" ")[1];

  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

/* ===============================
   EXISTING MQTT + DEVICE CODE
================================= */

const mqttOptions = {
  host: "3cb977d5787a4b53bec954b845ae0406.s1.eu.hivemq.cloud",
  port: 8883,
  protocol: "mqtts",
  username: "Tecnoris_Systems",
  password: "Nitin@1996",
  rejectUnauthorized: false
};

const mqttClient = mqtt.connect(mqttOptions);

let devices = {};

mqttClient.on("connect", () => {
  mqttClient.subscribe("plant/heartbeat");
  mqttClient.subscribe("plant/status");
});

mqttClient.on("message", (topic, message) => {
  const data = JSON.parse(message.toString());
  if (!data.deviceId) return;

  if (!devices[data.deviceId]) {
    devices[data.deviceId] = {
      status: "offline",
      moisture: 0,
      pump: "OFF",
      lastSeen: 0
    };
  }

  if (topic === "plant/heartbeat") {
    devices[data.deviceId].lastSeen = Date.now();
    devices[data.deviceId].status = "online";
  }

  if (topic === "plant/status") {
    devices[data.deviceId].moisture = data.moisture;
    devices[data.deviceId].pump = data.pump;
  }
});

setInterval(() => {
  const now = Date.now();
  for (let id in devices) {
    if (now - devices[id].lastSeen > 30000) {
      devices[id].status = "offline";
    }
  }
}, 10000);

/* ===============================
   PROTECTED DEVICE ROUTES
================================= */

app.get("/api/device/:id", verifyToken, (req, res) => {
  const device = devices[req.params.id];
  if (!device) return res.json({ status: "offline" });
  res.json(device);
});

app.post("/api/device/:id/pump", verifyToken, (req, res) => {
  const { state } = req.body;

  mqttClient.publish(
    "plant/control",
    JSON.stringify({
      deviceId: req.params.id,
      pump: state
    })
  );

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
