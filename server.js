const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mqtt = require("mqtt");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

/* ===============================
   HIVEMQ CLOUD CONFIG
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
  console.log("✅ Connected to HiveMQ Cloud");
  mqttClient.subscribe("plant/heartbeat");
  mqttClient.subscribe("plant/status");
});

mqttClient.on("error", (err) => {
  console.log("❌ MQTT Error:", err.message);
});

mqttClient.on("message", (topic, message) => {
  try {
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

  } catch (err) {
    console.log("Invalid MQTT payload");
  }
});

/* ===============================
   OFFLINE DETECTION
================================= */

setInterval(() => {
  const now = Date.now();
  for (let id in devices) {
    if (now - devices[id].lastSeen > 30000) {
      devices[id].status = "offline";
    }
  }
}, 10000);

/* ===============================
   API ROUTES
================================= */

// Health check route
app.get("/", (req, res) => {
  res.send("Plant IoT Cloud Backend Running");
});

// Get device info
app.get("/api/device/:id", (req, res) => {
  const device = devices[req.params.id];

  if (!device) {
    return res.json({ status: "offline" });
  }

  res.json(device);
});

// Control pump
app.post("/api/device/:id/pump", (req, res) => {
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
  console.log(`🚀 Server running on port ${PORT}`);
});
