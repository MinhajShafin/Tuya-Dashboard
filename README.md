# Tuya Smart Plug Dashboard

A real-time React.js dashboard for monitoring Tuya smart plugs locally without using cloud APIs. This application connects directly to your Tuya device on your local network and provides real-time monitoring with data storage in CSV format.

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
- Tuya smart plug on your local network
- Device ID, Key, and IP address of your Tuya device

## Installation

1. **Clone or navigate to the project directory**

   ```bash
   cd "/home/billy/tuya dashboard"
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
   Update the `.env` file with your Tuya device credentials:
   ```env
   TUYA_DEVICE_ID=your_device_id
   TUYA_DEVICE_KEY=your_device_key
   TUYA_DEVICE_IP=your_device_ip
   ```

## Getting Tuya Device Credentials

To get your Tuya device credentials, you can use the `tuyapi` CLI tool:

```bash
# Install tuyapi CLI globally
npm install -g @tuyapi/cli

# Scan for devices on your network
tuya-cli wizard
```

Alternatively, you can find the device information through:

- Tuya Smart app developer tools
- Network scanning tools
- Tuya IoT platform (for advanced users)

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

1. **Device not connecting**

   - Verify your device credentials in `.env`
   - Ensure device is on the same network
   - Check if device IP address is correct

2. **WebSocket connection issues**

   - Make sure port 8080 is not blocked by firewall
   - Check browser console for WebSocket errors

3. **Data not updating**
   - Verify device is powered on and connected to network
   - Check server logs for connection errors

## Architecture

- **Backend**: Node.js with Express server
- **Frontend**: React.js with real-time charts
- **Device Communication**: TuyAPI for local device communication
- **Real-time Updates**: WebSocket for live data streaming
- **Data Storage**: CSV files for data persistence

## Security Notes

- This application communicates directly with your Tuya device locally
- No data is sent to external cloud services
- Keep your device credentials secure in the `.env` file
- Consider running this on a private network for security

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License
