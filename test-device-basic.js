const TuyAPI = require("tuyapi");
require("dotenv").config();

console.log("Testing basic Tuya device connection...");

const device = new TuyAPI({
  id: process.env.TUYA_DEVICE_ID,
  key: process.env.TUYA_DEVICE_KEY,
  ip: process.env.TUYA_DEVICE_IP,
  version: "3.3",
  issueGetOnConnect: true,
  issueRefreshOnConnect: true,
});

device.on("connected", () => {
  console.log("✓ Device connected");
});

device.on("disconnected", () => {
  console.log("Device disconnected");
});

device.on("error", (error) => {
  console.log("Error:", error);
});

device.on("data", (data) => {
  console.log("✓ Data received:", JSON.stringify(data, null, 2));
});

device.on("dp-refresh", (data) => {
  console.log("✓ DP Refresh:", JSON.stringify(data, null, 2));
});

async function testBasicConnection() {
  try {
    console.log("Finding and connecting...");
    await device.find();
    await device.connect();

    console.log("Waiting for data...");

    // Just wait and listen for events
    setTimeout(() => {
      console.log("Test completed");
      device.disconnect();
      process.exit(0);
    }, 10000);
  } catch (error) {
    console.error("Connection failed:", error);
    process.exit(1);
  }
}

testBasicConnection();
