const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const TuyAPI = require("tuyapi");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "client/build")));

// WebSocket Server
const wss = new WebSocket.Server({ port: 8080 });

// Tuya Device Configuration
const device = new TuyAPI({
  id: process.env.TUYA_DEVICE_ID,
  key: process.env.TUYA_DEVICE_KEY,
  ip: process.env.TUYA_DEVICE_IP,
  version: "3.4",
  issueGetOnConnect: true,
  issueRefreshOnConnect: true,
});

// CSV Writer Configuration
const csvWriter = createCsvWriter({
  path: path.join(__dirname, "device_data.csv"),
  header: [
    { id: "timestamp", title: "Timestamp" },
    { id: "power_state", title: "Power State" },
    { id: "current", title: "Current (mA)" },
    { id: "power", title: "Power (W)" },
    { id: "voltage", title: "Voltage (V)" },
    { id: "energy", title: "Energy (kWh)" },
  ],
  append: true,
});

// Check if CSV file exists, if not create headers
const csvPath = path.join(__dirname, "device_data.csv");
if (!fs.existsSync(csvPath)) {
  csvWriter.writeRecords([]).then(() => {
    console.log("CSV file created with headers");
  });
}

let latestDeviceData = {
  timestamp: new Date().toISOString(),
  power_state: false,
  current: 0,
  power: 0,
  voltage: 0,
  energy: 0,
  connected: false,
};

// Device connection and data handling
let deviceConnected = false;

async function connectToDevice() {
  try {
    console.log("Attempting to connect to device...");
    await device.find();
    console.log("Device found, connecting...");
    await device.connect();
    deviceConnected = true;
    latestDeviceData.connected = true;
    console.log("Connected to Tuya device successfully");

    // Broadcast connection status
    broadcastToClients({
      type: "connection",
      data: { connected: true },
    });

    // Add event listeners for device data
    device.on("data", (data) => {
      console.log("Received device data:", data);
      handleDeviceData(data);
    });

    device.on("error", (error) => {
      console.error("Device error:", error);
      deviceConnected = false;
      latestDeviceData.connected = false;
      broadcastToClients({
        type: "error",
        data: { error: error.message },
      });
    });

    device.on("disconnect", () => {
      console.log("Device disconnected");
      deviceConnected = false;
      latestDeviceData.connected = false;
      broadcastToClients({
        type: "connection",
        data: { connected: false },
      });
      // Try to reconnect after 5 seconds
      setTimeout(connectToDevice, 5000);
    });

    // Get initial device status with timeout
    await getDeviceStatusSafe();

    // Set up periodic data collection
    setInterval(async () => {
      if (deviceConnected) {
        await getDeviceStatusSafe();
      }
    }, 5000); // Update every 5 seconds
  } catch (error) {
    console.error("Failed to connect to device:", error);
    deviceConnected = false;
    latestDeviceData.connected = false;

    broadcastToClients({
      type: "connection",
      data: { connected: false, error: error.message },
    });

    // Retry connection after 10 seconds
    setTimeout(connectToDevice, 10000);
  }
}

async function getDeviceStatusSafe() {
  try {
    // Try to get status with a shorter timeout
    const status = await Promise.race([
      device.get({ schema: true }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 3000)
      ),
    ]);

    console.log("Raw device status:", status);
    handleDeviceData(status);
  } catch (error) {
    console.error("Error getting device status:", error);
    // Don't disconnect on single timeout, just log the error
    if (error.message !== "Timeout") {
      latestDeviceData.connected = false;
      broadcastToClients({
        type: "error",
        data: { error: error.message },
      });
    }
  }
}

function handleDeviceData(data) {
  try {
    console.log("Processing device data:", data);

    // Parse the status data (DPS values)
    const dps = data.dps || data;

    const deviceData = {
      timestamp: new Date().toISOString(),
      power_state:
        dps["1"] !== undefined ? dps["1"] : latestDeviceData.power_state,
      current: dps["18"] !== undefined ? dps["18"] : latestDeviceData.current,
      power: dps["19"] !== undefined ? dps["19"] : latestDeviceData.power,
      voltage: dps["20"] !== undefined ? dps["20"] : latestDeviceData.voltage,
      energy: dps["22"] !== undefined ? dps["22"] : latestDeviceData.energy, // Updated to use DPS 22
      connected: true,
    };

    // Convert voltage to proper units (your device reports in 0.1V)
    if (typeof deviceData.voltage === "number") {
      deviceData.voltage = deviceData.voltage / 10; // Convert to V
    }

    // Convert power to proper units (your device reports in 0.1W)
    if (typeof deviceData.power === "number") {
      deviceData.power = deviceData.power / 10; // Convert to W
    }

    // Convert energy to proper units (your device reports in Wh, convert to kWh)
    if (typeof deviceData.energy === "number") {
      deviceData.energy = deviceData.energy / 1000; // Convert to kWh
    }

    latestDeviceData = deviceData;
    console.log("Processed device data:", deviceData);

    // Write to CSV
    csvWriter.writeRecords([deviceData]).catch((err) => {
      console.error("Error writing to CSV:", err);
    });

    // Broadcast to all connected WebSocket clients
    broadcastToClients({
      type: "data",
      data: deviceData,
    });
  } catch (error) {
    console.error("Error processing device data:", error);
  }
}

async function getDeviceStatus() {
  await getDeviceStatusSafe();
}

function broadcastToClients(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// WebSocket connection handling
wss.on("connection", (ws) => {
  console.log("Client connected to WebSocket");

  // Send latest data to newly connected client
  ws.send(
    JSON.stringify({
      type: "data",
      data: latestDeviceData,
    })
  );

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);
      console.log("Received WebSocket message:", data);

      if (data.type === "toggle" && deviceConnected) {
        // Toggle device power state
        console.log(
          "Toggling device power state from:",
          latestDeviceData.power_state
        );
        const newState = !latestDeviceData.power_state;

        try {
          await device.set({ dps: 1, set: newState });
          console.log("Device toggled successfully to:", newState);

          // Update local state immediately for better UX
          latestDeviceData.power_state = newState;
          latestDeviceData.timestamp = new Date().toISOString();

          // Broadcast the change
          broadcastToClients({
            type: "data",
            data: latestDeviceData,
          });
        } catch (toggleError) {
          console.error("Error toggling device:", toggleError);
          ws.send(
            JSON.stringify({
              type: "error",
              data: {
                error: "Failed to toggle device: " + toggleError.message,
              },
            })
          );
        }
      }

      if (data.type === "refresh") {
        // Manual refresh request
        await getDeviceStatusSafe();
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          data: { error: error.message },
        })
      );
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected from WebSocket");
  });
});

// REST API endpoints
app.get("/api/status", (req, res) => {
  res.json(latestDeviceData);
});

app.get("/api/data/csv", (req, res) => {
  const csvPath = path.join(__dirname, "device_data.csv");
  if (fs.existsSync(csvPath)) {
    res.download(csvPath);
  } else {
    res.status(404).json({ error: "CSV file not found" });
  }
});

app.post("/api/toggle", async (req, res) => {
  try {
    if (!deviceConnected) {
      return res.status(400).json({ error: "Device not connected" });
    }

    await device.set({ dps: 1, set: !latestDeviceData.power_state });
    res.json({ success: true, new_state: !latestDeviceData.power_state });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve React app
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client/build", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server running on port 8080`);

  // Connect to Tuya device
  connectToDevice();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  if (deviceConnected) {
    device.disconnect();
  }
  process.exit(0);
});

process.on("SIGINT", () => {
  if (deviceConnected) {
    device.disconnect();
  }
  process.exit(0);
});
