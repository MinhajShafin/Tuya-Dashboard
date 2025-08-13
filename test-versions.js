const TuyAPI = require("tuyapi");
require("dotenv").config();

console.log("Testing multiple protocol versions...");

async function testVersion(version) {
  console.log(`\n--- Testing version ${version} ---`);

  const device = new TuyAPI({
    id: process.env.TUYA_DEVICE_ID,
    key: process.env.TUYA_DEVICE_KEY,
    ip: process.env.TUYA_DEVICE_IP,
    version: version,
    issueGetOnConnect: true,
    issueRefreshOnConnect: true,
  });

  let dataReceived = false;

  device.on("connected", () => {
    console.log(`✓ Connected with version ${version}`);
  });

  device.on("disconnected", () => {
    console.log(`Disconnected from version ${version}`);
  });

  device.on("error", (error) => {
    console.log(`Error with version ${version}:`, error.message);
  });

  device.on("data", (data) => {
    console.log(
      `✓ Data received with version ${version}:`,
      JSON.stringify(data, null, 2)
    );
    dataReceived = true;
  });

  device.on("dp-refresh", (data) => {
    console.log(
      `✓ DP Refresh with version ${version}:`,
      JSON.stringify(data, null, 2)
    );
    dataReceived = true;
  });

  try {
    await device.find();
    await device.connect();

    // Wait for data
    await new Promise((resolve) => setTimeout(resolve, 5000));

    if (dataReceived) {
      console.log(`✓ SUCCESS: Version ${version} works!`);

      // Try to get status manually
      try {
        const status = await device.get();
        console.log(
          `✓ Manual status with version ${version}:`,
          JSON.stringify(status, null, 2)
        );
      } catch (e) {
        console.log(`Manual status failed with version ${version}:`, e.message);
      }

      // Try to toggle
      try {
        await device.set({ dps: 1, set: true });
        console.log(`✓ Set command sent with version ${version}`);
      } catch (e) {
        console.log(`Set command failed with version ${version}:`, e.message);
      }
    }

    device.disconnect();
  } catch (error) {
    console.log(`Connection failed with version ${version}:`, error.message);
  }

  return dataReceived;
}

async function testAllVersions() {
  const versions = ["3.1", "3.3", "3.4"];

  for (const version of versions) {
    const success = await testVersion(version);
    if (success) {
      console.log(
        `\n🎉 Version ${version} is working! Use this version in your dashboard.`
      );
      break;
    }
    // Wait between tests
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log("\nTesting complete.");
  process.exit(0);
}

testAllVersions();
