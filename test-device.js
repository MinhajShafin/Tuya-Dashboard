const TuyAPI = require("tuyapi");
require("dotenv").config();

console.log("Testing Tuya device connection...");
console.log("Device ID:", process.env.TUYA_DEVICE_ID);
console.log("Device IP:", process.env.TUYA_DEVICE_IP);

const device = new TuyAPI({
  id: process.env.TUYA_DEVICE_ID,
  key: process.env.TUYA_DEVICE_KEY,
  ip: process.env.TUYA_DEVICE_IP,
  version: "3.3",
  issueGetOnConnect: false,
  issueRefreshOnConnect: false,
});

async function testConnection() {
  try {
    console.log("Finding device...");
    await device.find();
    console.log("✓ Device found");

    console.log("Connecting to device...");
    await device.connect();
    console.log("✓ Connected to device");

    console.log("Getting device schema...");
    const schema = await device.get({ schema: true });
    console.log("✓ Device schema:", JSON.stringify(schema, null, 2));

    console.log("Getting device status...");
    const status = await device.get();
    console.log("✓ Device status:", JSON.stringify(status, null, 2));

    // Test setting a value (toggle)
    console.log("Testing toggle...");
    const currentState = status.dps ? status.dps["1"] : false;
    console.log("Current power state:", currentState);

    await device.set({ dps: "1", set: !currentState });
    console.log("✓ Toggle command sent");

    // Wait a moment then check status again
    setTimeout(async () => {
      try {
        const newStatus = await device.get();
        console.log(
          "✓ New status after toggle:",
          JSON.stringify(newStatus, null, 2)
        );

        // Toggle back
        await device.set({ dps: "1", set: currentState });
        console.log("✓ Toggled back to original state");

        device.disconnect();
        console.log("✓ Test completed successfully");
        process.exit(0);
      } catch (error) {
        console.error("Error in final check:", error);
        process.exit(1);
      }
    }, 2000);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Handle events
device.on("connected", () => {
  console.log("Event: Connected");
});

device.on("disconnected", () => {
  console.log("Event: Disconnected");
});

device.on("error", (error) => {
  console.log("Event: Error -", error);
});

device.on("data", (data) => {
  console.log("Event: Data received -", data);
});

testConnection();
