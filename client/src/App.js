import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const App = () => {
  const [deviceData, setDeviceData] = useState({
    timestamp: new Date().toISOString(),
    power_state: false,
    current: 0,
    power: 0,
    voltage: 0,
    energy: 0,
    connected: false,
  });

  const [historicalData, setHistoricalData] = useState([]);
  const [ws, setWs] = useState(null);
  const [connecting, setConnecting] = useState(true);

  const connectWebSocket = useCallback(() => {
    if (ws) {
      ws.close();
    }

    const websocket = new WebSocket("ws://localhost:8080");

    websocket.onopen = () => {
      console.log("Connected to WebSocket");
      setConnecting(false);
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("Received message:", message);

        if (message.type === "data") {
          setDeviceData(message.data);

          // Add to historical data (keep last 50 points)
          setHistoricalData((prev) => {
            const newData = [
              ...prev,
              {
                time: new Date(message.data.timestamp).toLocaleTimeString(),
                power: parseFloat(message.data.power) || 0,
                current: parseFloat(message.data.current) || 0,
                voltage: parseFloat(message.data.voltage) || 0,
              },
            ];
            return newData.slice(-50);
          });
        }

        if (message.type === "connection") {
          setDeviceData((prev) => ({
            ...prev,
            connected: message.data.connected,
          }));
        }

        if (message.type === "error") {
          console.error("Server error:", message.data.error);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    websocket.onclose = () => {
      console.log("WebSocket disconnected, attempting to reconnect...");
      setConnecting(true);
      setTimeout(connectWebSocket, 3000);
    };

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    setWs(websocket);
  }, []); // Remove ws dependency to fix the warning

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [connectWebSocket]);

  const toggleDevice = () => {
    if (ws && ws.readyState === WebSocket.OPEN && deviceData.connected) {
      console.log("Sending toggle command");
      ws.send(JSON.stringify({ type: "toggle" }));
    } else {
      console.log("Cannot toggle: WebSocket not ready or device not connected");
    }
  };

  const refreshData = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "refresh" }));
    }
  };

  const downloadCSV = () => {
    window.open("/api/data/csv", "_blank");
  };

  if (connecting) {
    return (
      <div className="loading">
        <h2>Connecting to Tuya Smart Plug...</h2>
        <p>Please wait while we establish connection</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="header">
        <h1>Tuya Smart Plug Dashboard</h1>
        <div
          className={`connection-status ${
            deviceData.connected ? "connected" : "disconnected"
          }`}
        >
          <div
            className={`status-dot ${
              deviceData.connected ? "connected" : "disconnected"
            }`}
          ></div>
          {deviceData.connected ? "Connected" : "Disconnected"}
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Device Control */}
        <div className="card control-card">
          <h3>Device Control</h3>
          <button
            className={`power-button ${deviceData.power_state ? "on" : "off"}`}
            onClick={toggleDevice}
            disabled={!deviceData.connected}
          >
            {deviceData.power_state ? "ON" : "OFF"}
          </button>
          <p>Click to toggle power state</p>
        </div>

        {/* Real-time Metrics */}
        <div className="card">
          <h3>Real-time Metrics</h3>
          <div className="metrics-grid">
            <div className="metric">
              <div className="metric-value">{deviceData.power.toFixed(1)}</div>
              <div className="metric-label">Power (W)</div>
            </div>
            <div className="metric">
              <div className="metric-value">
                {deviceData.current.toFixed(0)}
              </div>
              <div className="metric-label">Current (mA)</div>
            </div>
            <div className="metric">
              <div className="metric-value">
                {deviceData.voltage.toFixed(1)}
              </div>
              <div className="metric-label">Voltage (V)</div>
            </div>
            <div className="metric">
              <div className="metric-value">{deviceData.energy.toFixed(3)}</div>
              <div className="metric-label">Energy (kWh)</div>
            </div>
          </div>
        </div>

        {/* Historical Chart */}
        <div className="card chart-card">
          <h3>Historical Data</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="power"
                  stroke="#8884d8"
                  strokeWidth={2}
                  name="Power (W)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="voltage"
                  stroke="#82ca9d"
                  strokeWidth={2}
                  name="Voltage (V)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="current"
                  stroke="#ffc658"
                  strokeWidth={2}
                  name="Current (mA)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="actions">
        <button className="action-button" onClick={downloadCSV}>
          Download CSV Data
        </button>
        <button className="action-button" onClick={refreshData}>
          Refresh Data
        </button>
      </div>

      <div className="timestamp">
        Last updated: {new Date(deviceData.timestamp).toLocaleString()}
      </div>
    </div>
  );
};

export default App;
