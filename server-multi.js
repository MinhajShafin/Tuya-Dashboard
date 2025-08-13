const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const TuyAPI = require("tuyapi");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const path = require("path");
const fs = require("fs");
const http = require("http");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "client/build")));

// WebSocket Server - attached to the same HTTP server
const wss = new WebSocket.Server({ server });

// Device Management
let devices = new Map(); // Store TuyAPI instances
let deviceData = new Map(); // Store latest data for each device
let deviceWriters = new Map(); // Store CSV writers for each device

// Load device configuration
function loadDeviceConfig() {
  try {
    const configPath = path.join(__dirname, "devices.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      return config; // Return ALL devices, not just enabled ones
    }
  } catch (error) {
    console.error("Error loading device config:", error);
  }

  // Fallback to .env configuration
  if (process.env.TUYA_DEVICE_ID) {
    return [
      {
        id: "device_1",
        name: "Smart Plug",
        device_id: process.env.TUYA_DEVICE_ID,
        device_key: process.env.TUYA_DEVICE_KEY,
        device_ip: process.env.TUYA_DEVICE_IP,
        version: "3.4",
        type: "smart_plug",
        room: "Unknown",
        enabled: true,
      },
    ];
  }

  return [];
}

// Initialize CSV writer for a device
function initializeCSVWriter(deviceId, deviceName) {
  const csvWriter = createCsvWriter({
    path: path.join(__dirname, `${deviceId}_data.csv`),
    header: [
      { id: "timestamp", title: "Timestamp" },
      { id: "device_id", title: "Device ID" },
      { id: "device_name", title: "Device Name" },
      { id: "power_state", title: "Power State" },
      { id: "current", title: "Current (mA)" },
      { id: "power", title: "Power (W)" },
      { id: "voltage", title: "Voltage (V)" },
      { id: "energy", title: "Energy (kWh)" },
    ],
    append: true,
  });

  const csvPath = path.join(__dirname, `${deviceId}_data.csv`);
  if (!fs.existsSync(csvPath)) {
    csvWriter.writeRecords([]).then(() => {
      console.log(`CSV file created for ${deviceName}`);
    });
  }

  return csvWriter;
}

// Initialize device data
function initializeDeviceData(deviceConfig) {
  return {
    id: deviceConfig.id,
    name: deviceConfig.name,
    type: deviceConfig.type,
    room: deviceConfig.room,
    timestamp: new Date().toISOString(),
    power_state: false,
    current: 0,
    power: 0,
    voltage: 0,
    energy: 0,
    connected: false,
    ip: deviceConfig.device_ip,
    version: deviceConfig.version,
    enabled: deviceConfig.enabled || false, // Add enabled property
  };
}

// Handle device data processing
function handleDeviceData(deviceId, data) {
  try {
    console.log(`Processing data for ${deviceId}:`, data);

    const dps = data.dps || data;
    const currentData = deviceData.get(deviceId);

    if (!currentData) return;

    const updatedData = {
      ...currentData,
      timestamp: new Date().toISOString(),
      power_state: dps["1"] !== undefined ? dps["1"] : currentData.power_state,
      current: dps["18"] !== undefined ? dps["18"] : currentData.current,
      power: dps["19"] !== undefined ? dps["19"] : currentData.power,
      voltage: dps["20"] !== undefined ? dps["20"] : currentData.voltage,
      energy: dps["22"] !== undefined ? dps["22"] : currentData.energy,
      connected: true,
    };

    // Convert voltage to proper units
    if (typeof updatedData.voltage === "number") {
      updatedData.voltage = updatedData.voltage / 10;
    }

    // Convert power to proper units
    if (typeof updatedData.power === "number") {
      updatedData.power = updatedData.power / 10;
    }

    // Convert current to proper units (some devices may need scaling)
    if (typeof updatedData.current === "number" && updatedData.current > 1000) {
      // Only scale if the value seems to be in raw format (>1000 suggests raw mA value)
      updatedData.current = updatedData.current / 10;
    }

    // Convert energy to proper units
    if (typeof updatedData.energy === "number") {
      updatedData.energy = updatedData.energy / 1000;
    }

    deviceData.set(deviceId, updatedData);
    console.log(`Processed data for ${deviceId}:`, updatedData);

    // Write to CSV
    const writer = deviceWriters.get(deviceId);
    if (writer) {
      writer
        .writeRecords([
          {
            ...updatedData,
            device_id: deviceId,
            device_name: updatedData.name,
          },
        ])
        .catch((err) => {
          console.error(`Error writing to CSV for ${deviceId}:`, err);
        });
    }

    // Broadcast to all connected WebSocket clients
    broadcastToClients({
      type: "device_data",
      deviceId: deviceId,
      data: updatedData,
    });
  } catch (error) {
    console.error(`Error processing data for ${deviceId}:`, error);
  }
}

// Connect to a single device
async function connectToDevice(deviceConfig) {
  const deviceId = deviceConfig.id;

  try {
    console.log(
      `Attempting to connect to ${deviceConfig.name} (${deviceId})...`
    );

    const device = new TuyAPI({
      id: deviceConfig.device_id,
      key: deviceConfig.device_key.replace(/"/g, ""),
      ip: deviceConfig.device_ip,
      version: deviceConfig.version,
      issueGetOnConnect: true,
      issueRefreshOnConnect: true,
    });

    await device.find();
    await device.connect();

    devices.set(deviceId, device);

    // Update connection status
    const currentData = deviceData.get(deviceId);
    if (currentData) {
      currentData.connected = true;
      deviceData.set(deviceId, currentData);
    }

    console.log(`✓ Connected to ${deviceConfig.name}`);

    // Set up event listeners
    device.on("data", (data) => {
      handleDeviceData(deviceId, data);
    });

    device.on("error", (error) => {
      console.error(`Error on ${deviceConfig.name}:`, error);
      if (currentData) {
        currentData.connected = false;
        deviceData.set(deviceId, currentData);
      }
      broadcastToClients({
        type: "device_error",
        deviceId: deviceId,
        data: { error: error.message },
      });
    });

    device.on("disconnect", () => {
      console.log(`${deviceConfig.name} disconnected`);
      if (currentData) {
        currentData.connected = false;
        deviceData.set(deviceId, currentData);
      }
      broadcastToClients({
        type: "device_disconnect",
        deviceId: deviceId,
      });

      // Try to reconnect after 10 seconds
      setTimeout(() => connectToDevice(deviceConfig), 10000);
    });

    // Broadcast connection status
    broadcastToClients({
      type: "device_connect",
      deviceId: deviceId,
      data: currentData,
    });
  } catch (error) {
    console.error(`Failed to connect to ${deviceConfig.name}:`, error);
    const currentData = deviceData.get(deviceId);
    if (currentData) {
      currentData.connected = false;
      deviceData.set(deviceId, currentData);
    }

    broadcastToClients({
      type: "device_error",
      deviceId: deviceId,
      data: { error: error.message },
    });

    // Retry connection after 15 seconds
    setTimeout(() => connectToDevice(deviceConfig), 15000);
  }
}

// Connect to all devices
async function connectToAllDevices() {
  const deviceConfigs = loadDeviceConfig();

  if (deviceConfigs.length === 0) {
    console.log(
      "No devices configured. Please add devices to devices.json or set environment variables."
    );
    return;
  }

  console.log(`Found ${deviceConfigs.length} device(s) total...`);

  const enabledDevices = deviceConfigs.filter((device) => device.enabled);
  console.log(`${enabledDevices.length} enabled device(s) to connect...`);
  console.log(
    `${
      deviceConfigs.length - enabledDevices.length
    } disabled device(s) to show...`
  );

  // Initialize data for ALL devices (enabled and disabled)
  for (const deviceConfig of deviceConfigs) {
    // Initialize device data and CSV writer
    deviceData.set(deviceConfig.id, initializeDeviceData(deviceConfig));
    deviceWriters.set(
      deviceConfig.id,
      initializeCSVWriter(deviceConfig.id, deviceConfig.name)
    );
  }

  // Only try to connect to ENABLED devices
  for (const deviceConfig of enabledDevices) {
    // Connect to device (with delay to avoid overwhelming the network)
    setTimeout(
      () => connectToDevice(deviceConfig),
      enabledDevices.indexOf(deviceConfig) * 2000
    );
  }

  // Start periodic data refresh for connected devices
  startPeriodicRefresh();
}

// Periodic data refresh to get latest values from devices
function startPeriodicRefresh() {
  setInterval(async () => {
    for (const [deviceId, device] of devices) {
      try {
        if (device && device.isConnected()) {
          // Request fresh data from the device
          await device.get();
        }
      } catch (error) {
        console.log(`Error refreshing data for ${deviceId}:`, error.message);
      }
    }
  }, 10000); // Refresh every 10 seconds
}

// Broadcast message to all WebSocket clients
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

  // Send current data for all devices to newly connected client
  const allDevicesData = Array.from(deviceData.values());
  console.log(
    `Sending initial data for ${allDevicesData.length} devices to client`
  );

  ws.send(
    JSON.stringify({
      type: "initial_data",
      data: allDevicesData,
    })
  );

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);
      console.log("Received WebSocket message:", data);

      if (data.type === "toggle" && data.deviceId) {
        const device = devices.get(data.deviceId);
        const currentData = deviceData.get(data.deviceId);

        if (device && currentData && currentData.connected) {
          console.log(
            `Toggling ${data.deviceId} from:`,
            currentData.power_state
          );
          const newState = !currentData.power_state;

          try {
            await device.set({ dps: 1, set: newState });
            console.log(
              `Device ${data.deviceId} toggled successfully to:`,
              newState
            );

            // Update local state immediately
            currentData.power_state = newState;
            currentData.timestamp = new Date().toISOString();
            deviceData.set(data.deviceId, currentData);

            // Broadcast the change
            broadcastToClients({
              type: "device_data",
              deviceId: data.deviceId,
              data: currentData,
            });
          } catch (toggleError) {
            console.error(`Error toggling ${data.deviceId}:`, toggleError);
            ws.send(
              JSON.stringify({
                type: "error",
                deviceId: data.deviceId,
                data: {
                  error: "Failed to toggle device: " + toggleError.message,
                },
              })
            );
          }
        } else {
          ws.send(
            JSON.stringify({
              type: "error",
              deviceId: data.deviceId,
              data: { error: "Device not connected" },
            })
          );
        }
      }

      if (data.type === "refresh") {
        // Send current data for all devices
        const allDevicesData = Array.from(deviceData.values());
        ws.send(
          JSON.stringify({
            type: "initial_data",
            data: allDevicesData,
          })
        );
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
app.get("/api/devices", (req, res) => {
  const allDevicesData = Array.from(deviceData.values());
  res.json(allDevicesData);
});

app.get("/api/devices/:deviceId", (req, res) => {
  const deviceId = req.params.deviceId;
  const data = deviceData.get(deviceId);

  if (data) {
    res.json(data);
  } else {
    res.status(404).json({ error: "Device not found" });
  }
});

app.post("/api/devices/:deviceId/toggle", async (req, res) => {
  const deviceId = req.params.deviceId;
  const device = devices.get(deviceId);
  const currentData = deviceData.get(deviceId);

  try {
    if (!device || !currentData || !currentData.connected) {
      return res.status(400).json({ error: "Device not connected" });
    }

    const newState = !currentData.power_state;
    await device.set({ dps: 1, set: newState });

    res.json({
      success: true,
      deviceId: deviceId,
      new_state: newState,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/devices/:deviceId/csv", (req, res) => {
  const deviceId = req.params.deviceId;
  const csvPath = path.join(__dirname, `${deviceId}_data.csv`);

  if (fs.existsSync(csvPath)) {
    res.download(csvPath);
  } else {
    res.status(404).json({ error: "CSV file not found for this device" });
  }
});

// Historical data endpoint with date range support
app.get("/api/devices/:deviceId/history", (req, res) => {
  const deviceId = req.params.deviceId;
  const { startDate, endDate } = req.query;

  try {
    // Generate sample historical data for demonstration
    // In a real application, this would query a database
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const historicalData = generateSampleHistoricalData(deviceId, start, end);

    res.json({
      deviceId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      data: historicalData,
    });
  } catch (error) {
    console.error("Error fetching historical data:", error);
    res.status(500).json({ error: "Failed to fetch historical data" });
  }
});

// Generate sample historical data for testing
function generateSampleHistoricalData(deviceId, startDate, endDate) {
  const data = [];
  const duration = endDate.getTime() - startDate.getTime();
  const intervalHours = 1; // Data point every hour for cleaner display
  const intervals = Math.floor(duration / (intervalHours * 60 * 60 * 1000));

  // Base values for realistic power consumption patterns
  const baseValues = {
    device_1: { power: 35, voltage: 215, current: 300 }, // Real device
    default: { power: 25, voltage: 220, current: 250 }, // Simulated devices
  };

  const base = baseValues[deviceId] || baseValues.default;

  for (let i = 0; i <= Math.min(intervals, 168); i++) {
    // Limit to 168 hours (1 week) max
    const timestamp = new Date(
      startDate.getTime() + i * intervalHours * 60 * 60 * 1000
    );

    // Add some realistic variation to the data
    const timeOfDay = timestamp.getHours();
    const dailyMultiplier =
      0.8 + (0.4 * (Math.sin(((timeOfDay - 6) * Math.PI) / 12) + 1)) / 2; // Peak during day
    const randomVariation = 0.9 + Math.random() * 0.2; // ±10% random variation

    const power = base.power * dailyMultiplier * randomVariation;
    const voltage = base.voltage + (Math.random() - 0.5) * 10; // ±5V variation
    const current = (power / voltage) * 1000; // Calculate current from power and voltage

    // Format time as hourly display (e.g., "14:00", "15:00")
    const hourlyTime = timestamp.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    data.push({
      time: hourlyTime,
      fullTimestamp: timestamp.toISOString(),
      timestamp: timestamp.getTime(),
      power: Math.round(power * 10) / 10,
      voltage: Math.round(voltage * 10) / 10,
      current: Math.round(current),
    });
  }

  return data;
}

// Add new device endpoint
app.post("/api/devices", async (req, res) => {
  try {
    const deviceConfig = req.body;

    // Validate required fields
    if (
      !deviceConfig.id ||
      !deviceConfig.device_id ||
      !deviceConfig.device_key ||
      !deviceConfig.device_ip
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Load current config
    const configPath = path.join(__dirname, "devices.json");
    let currentConfig = [];

    if (fs.existsSync(configPath)) {
      currentConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }

    // Check if device already exists
    if (currentConfig.find((d) => d.id === deviceConfig.id)) {
      return res.status(400).json({ error: "Device ID already exists" });
    }

    // Add new device to config
    const newDevice = {
      id: deviceConfig.id,
      name: deviceConfig.name || `Device ${deviceConfig.id}`,
      device_id: deviceConfig.device_id,
      device_key: deviceConfig.device_key,
      device_ip: deviceConfig.device_ip,
      version: deviceConfig.version || "3.4",
      type: deviceConfig.type || "smart_plug",
      room: deviceConfig.room || "Unknown",
      enabled: true,
    };

    currentConfig.push(newDevice);

    // Save updated config
    fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));

    // Initialize and connect to new device
    deviceData.set(newDevice.id, initializeDeviceData(newDevice));
    deviceWriters.set(
      newDevice.id,
      initializeCSVWriter(newDevice.id, newDevice.name)
    );

    // Connect to the new device
    connectToDevice(newDevice);

    res.json({ success: true, device: newDevice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove device endpoint
app.delete("/api/devices/:deviceId", async (req, res) => {
  try {
    const deviceId = req.params.deviceId;

    // Disconnect device if connected
    const device = devices.get(deviceId);
    if (device) {
      device.disconnect();
      devices.delete(deviceId);
    }

    // Remove from memory
    deviceData.delete(deviceId);
    deviceWriters.delete(deviceId);

    // Update config file
    const configPath = path.join(__dirname, "devices.json");
    if (fs.existsSync(configPath)) {
      let currentConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      currentConfig = currentConfig.filter((d) => d.id !== deviceId);
      fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
    }

    // Notify clients
    broadcastToClients({
      type: "device_removed",
      deviceId: deviceId,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve README.md file
app.get("/README.md", (req, res) => {
  const readmePath = path.join(__dirname, "README.md");
  if (fs.existsSync(readmePath)) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.sendFile(readmePath);
  } else {
    res.status(404).send("README.md not found");
  }
});

// Serve React app
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client/build", "index.html"));
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server running on the same port ${PORT}`);

  // Connect to all configured devices
  connectToAllDevices();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  devices.forEach((device) => {
    if (device) device.disconnect();
  });
  process.exit(0);
});

process.on("SIGINT", () => {
  devices.forEach((device) => {
    if (device) device.disconnect();
  });
  process.exit(0);
});
