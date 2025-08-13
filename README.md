# Tuya Smart Device Dashboard

A real-time React.js dashboard for monitoring Tuya smart devices locally without using cloud APIs. This application connects directly to your Tuya device on your local network and provides real-time monitoring with data storage in CSV format.

## Features

- **Real-time Monitoring**: Live updates of power consumption, current, voltage, and energy usage
- **Device Control**: Toggle power state directly from the dashboard
- **Data Visualization**: Interactive charts showing historical data trends
- **CSV Export**: Automatic data logging and CSV export functionality
- **Local Communication**: Direct connection to Tuya device without cloud dependency
- **Responsive Design**: Works on desktop and mobile devices

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Tuya smart device on your local network (smart plugs, switches, outlets, etc.)
- Device ID, Key, and IP address of your Tuya device

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd tuya-dashboard
   ```

2. **Install server dependencies**

   ```bash
   npm install
   ```

3. **Install client dependencies**

   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Configure your device**
   Copy the example environment file and update it with your device credentials:

   ```bash
   cp .env.example .env
   ```

   Then edit the `.env` file with your Tuya device credentials:

   ```env
   TUYA_DEVICE_ID=your_device_id_here
   TUYA_DEVICE_KEY=your_device_key_here
   TUYA_DEVICE_IP=your_device_ip_here
   ```

## Getting Tuya Device Credentials

### Method 1: Using TuyAPI CLI (Recommended)

The easiest way to get your device credentials:

```bash
# Install tuyapi CLI globally
npm install -g @tuyapi/cli

# Run the wizard to discover your device
npx @tuyapi/cli wizard
```

The wizard will:

1. Ask for your Tuya Developer API credentials (from tuya.com)
2. Scan and list all devices in your Tuya account
3. Provide the Device ID, Key, and current IP address

### Method 2: Manual Discovery

1. **Get Tuya Developer Account**:

   - Sign up at [iot.tuya.com](https://iot.tuya.com)
   - Create a project and get API Key and Secret

2. **Find Device Information**:
   - Use network scanning tools to find device IP
   - Extract device ID from Tuya Smart app or developer console
   - Get encryption key from Tuya IoT platform

### Method 3: Network Scanning

```bash
# Scan for Tuya devices on your network
npx @tuyapi/cli list-app
```

### Important Notes:

- **Protocol Version**: Different devices use different protocol versions (3.1, 3.3, 3.4)
- **Device Testing**: Use the included test scripts to verify connectivity
- **IP Changes**: Device IP may change; consider setting static IP in router

## Usage

1. **Start the application**

   ```bash
   npm run dev
   ```

   This will start both the backend server (port 5000) and React frontend (port 3000).

2. **Access the dashboard**
   Open your browser and go to `http://localhost:3000`

3. **Monitor your device**
   - View real-time power consumption data
   - Toggle device power state
   - Monitor historical trends in the chart
   - Download CSV data for analysis

## Testing Device Connection

Before running the full dashboard, test your device connection:

```bash
# Test different protocol versions
node test-versions.js

# Test basic connectivity
node test-device-basic.js

# Test specific protocol version (replace X.X with your version)
node test-34.js
```

## Device Compatibility

This dashboard has been tested with:

- ✅ Smart Plugs (energy monitoring)
- ✅ Smart Switches
- ✅ Smart Outlets
- ⚠️ Other Tuya devices (may require DPS mapping adjustments)

### Supported Data Points (DPS):

- `DPS 1`: Power state (on/off)
- `DPS 17`: Energy consumption (some devices)
- `DPS 18`: Current (mA)
- `DPS 19`: Power (0.1W units)
- `DPS 20`: Voltage (0.1V units)
- `DPS 22`: Energy consumption (Wh)

**Note**: Different devices may use different DPS mappings. Check the server logs to see what data points your device provides.

## API Endpoints

- `GET /api/status` - Get current device status
- `POST /api/toggle` - Toggle device power state
- `GET /api/data/csv` - Download CSV data file

## WebSocket Connection

The application uses WebSocket connection on port 8080 for real-time data updates.

## Data Storage

All device data is automatically stored in `device_data.csv` with the following columns:

- Timestamp
- Power State (on/off)
- Current (mA)
- Power (W)
- Voltage (V)
- Energy (kWh)

## Troubleshooting

### 1. Device not connecting

- **Check credentials**: Verify Device ID, Key, and IP in `.env` file
- **Network connectivity**: Ensure device is on the same network as your computer
- **IP address changes**: Device IP may change; use router DHCP reservation or re-scan
- **Protocol version**: Try different versions (3.1, 3.3, 3.4) using test scripts

### 2. No data received

- **DPS mapping**: Your device may use different data points
- **Check server logs**: Look for data structure in console output
- **Protocol compatibility**: Some devices need specific protocol versions
- **Device state**: Ensure device is powered on and responsive

### 3. WebSocket connection issues

- **Firewall**: Make sure port 8080 is not blocked
- **Browser console**: Check for WebSocket connection errors
- **Network**: Ensure stable network connection

### 4. Toggle not working

- **Device permissions**: Some devices require specific command formats
- **DPS commands**: Verify correct DPS number for power control
- **Connection state**: Ensure device is connected before sending commands

### 5. Incorrect data values

- **Unit conversion**: Adjust conversion factors in `handleDeviceData()` function
- **DPS interpretation**: Check which DPS points contain which data types
- **Device documentation**: Refer to device-specific DPS mapping

## Customization for Different Devices

If your device uses different DPS mappings, modify the `handleDeviceData()` function in `server.js`:

```javascript
// Example: Adjust DPS mappings for your device
const deviceData = {
  power_state: dps["1"], // Usually DPS 1 for most devices
  current: dps["18"] || dps["4"], // May vary by device
  power: dps["19"] || dps["5"], // Check your device's data structure
  voltage: dps["20"] || dps["6"], // Adjust as needed
  energy: dps["22"] || dps["17"], // Different devices use different DPS
};
```

## Architecture

- **Backend**: Node.js with Express server
- **Frontend**: React.js with real-time charts (Recharts)
- **Device Communication**: TuyAPI library for local device communication
- **Protocol**: Tuya local protocol (versions 3.1, 3.3, 3.4 supported)
- **Real-time Updates**: WebSocket for live data streaming
- **Data Storage**: CSV files for data persistence

## How It Works (No Cloud Required)

This dashboard communicates directly with your Tuya device on your local network:

1. **Device Discovery**: Finds device using IP address or network scan
2. **Local Protocol**: Uses reverse-engineered Tuya protocol for direct communication
3. **Encryption**: Handles local encryption using device-specific keys
4. **Real-time Data**: Receives live updates via device events
5. **Command Sending**: Sends control commands directly to device

**Traditional Method**: `App → Internet → Tuya Cloud → Internet → Device`
**Our Method**: `App → Local Network → Device (Direct)`

## Security & Privacy

- ✅ **Local Communication**: No data sent to external servers
- ✅ **Network Privacy**: All communication stays on your local network
- ✅ **Credential Security**: Device keys stored locally in `.env` file
- ✅ **Offline Capable**: Works without internet connection
- ⚠️ **Network Security**: Ensure your local network is secure
- ⚠️ **Credential Management**: Keep `.env` file secure and never commit to version control

## Contributing

We welcome contributions! Here's how you can help:

- 🐛 **Report bugs** for devices that don't work
- 📱 **Add support** for new device types
- 🔧 **Improve DPS mapping** for different devices
- 📚 **Update documentation** with device-specific instructions
- ⚡ **Performance improvements** and optimizations

### Adding Support for New Devices

1. Test device with included test scripts
2. Document DPS mapping in server logs
3. Update `handleDeviceData()` function if needed
4. Add device compatibility info to README
5. Submit pull request with changes

## License

MIT License - Feel free to use, modify, and distribute!
