const TuyAPI = require("tuyapi");
require("dotenv").config();

console.log("Testing Tuya device with version 3.4...");
console.log("Device ID:", process.env.TUYA_DEVICE_ID);
console.log("Device IP:", process.env.TUYA_DEVICE_IP);

const device = new TuyAPI({
  id: process.env.TUYA_DEVICE_ID,
  key: process.env.TUYA_DEVICE_KEY.replace(/"/g, ""), // Remove quotes if present
  ip: process.env.TUYA_DEVICE_IP,
  version: "3.4",
  issueGetOnConnect: true,
  issueRefreshOnConnect: true,
});

let dataReceived = false;

device.on("connected", () => {
  console.log("✓ Connected with version 3.4");
});

device.on("disconnected", () => {
  console.log("Disconnected from device");
});

device.on("error", (error) => {
  console.log("Error:", error.message);
});

device.on("data", (data) => {
  console.log("✓ Data received:", JSON.stringify(data, null, 2));
  dataReceived = true;
});

device.on("dp-refresh", (data) => {
  console.log("✓ DP Refresh:", JSON.stringify(data, null, 2));
  dataReceived = true;
});

async function testVersion34() {
  const testTimeout = setTimeout(() => {
    console.error("❌ Test timed out after 15 seconds. Forcing exit.");
    if (device.isConnected()) {
      device.disconnect();
    }
    process.exit(1);
  }, 15000);

  try {
    console.log("Finding and connecting...");
    await device.find();
    await device.connect();

    console.log("Waiting for data...");

    // Wait 8 seconds for data
    await new Promise((resolve) => setTimeout(resolve, 8000));

    if (dataReceived) {
      console.log("✓ SUCCESS: Version 3.4 works!");

      // Try manual status request
      try {
        console.log("Trying manual status request...");
        const status = await device.get();
        console.log("✓ Manual status:", JSON.stringify(status, null, 2));
      } catch (e) {
        console.log("Manual status failed:", e.message);
      }

      // Try toggle command
      try {
        console.log("Trying toggle command...");
        await device.set({ dps: 1, set: true });
        console.log("✓ Toggle command sent successfully");
      } catch (e) {
        console.log("Toggle failed:", e.message);
      }
    } else {
      console.log("❌ No data received with version 3.4");
    }
  } catch (error) {
    console.log("Connection failed:", error.message);
  } finally {
    console.log("Test completed. Disconnecting...");
    if (device.isConnected()) {
      device.disconnect();
    }
    clearTimeout(testTimeout);
    // Use a small delay to allow disconnect to happen before exiting
    setTimeout(() => process.exit(0), 500);
  }
}

testVersion34();
