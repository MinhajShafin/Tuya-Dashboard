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

// Bangladesh electricity tariff structure (in Taka per kWh)
const ELECTRICITY_TARIFF = [
  { min: 0, max: 75, rate: 4.62 },
  { min: 76, max: 200, rate: 6.31 },
  { min: 201, max: 300, rate: 6.62 },
  { min: 301, max: 400, rate: 6.99 },
  { min: 401, max: 600, rate: 10.96 },
  { min: 601, max: Infinity, rate: 12.63 },
];

// Calculate progressive billing cost in Bangladeshi Taka
const calculateBillingCost = (energyKWh) => {
  if (!energyKWh || energyKWh <= 0) return 0;

  let totalCost = 0;
  let remainingEnergy = energyKWh;

  for (const tier of ELECTRICITY_TARIFF) {
    if (remainingEnergy <= 0) break;

    const tierCapacity = tier.max - tier.min + 1;
    const energyInThisTier = Math.min(remainingEnergy, tierCapacity);

    // For the first tier (0-75), we start from 0
    const actualEnergyInTier =
      tier.min === 0
        ? Math.min(energyInThisTier, 75)
        : Math.min(energyInThisTier, tier.max - tier.min + 1);

    totalCost += actualEnergyInTier * tier.rate;
    remainingEnergy -= actualEnergyInTier;

    if (remainingEnergy <= 0) break;
    if (tier.max === Infinity) break;
  }

  return totalCost;
};

// Calculate real-time cost per hour based on current power consumption
const calculateRealTimeCost = (powerWatts) => {
  if (!powerWatts || powerWatts <= 0) return 0;

  // Convert watts to kWh for 1 hour
  const energyPerHour = powerWatts / 1000; // Convert W to kW

  // For real-time cost, we'll use the average residential rate
  // This is a simplified calculation for instantaneous cost
  const averageRate = 7.5; // TK per kWh (approximate middle rate)

  return energyPerHour * averageRate;
};

// Historical Data Viewer Component
const HistoricalDataViewer = ({ device, historicalData }) => {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16), // 24 hours ago
    endDate: new Date().toISOString().slice(0, 16), // now
  });
  const [viewType, setViewType] = useState("power"); // power, voltage, current, all
  const [historicalChartData, setHistoricalChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch historical data from server
  const fetchHistoricalData = useCallback(async () => {
    if (!device.id) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });

      const response = await fetch(
        `/api/devices/${device.id}/history?${params}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch historical data");
      }

      const result = await response.json();
      setHistoricalChartData(result.data || []);
    } catch (err) {
      console.error("Error fetching historical data:", err);
      setError(err.message);
      // Fallback to real-time historical data if API fails
      setHistoricalChartData(historicalData || []);
    } finally {
      setLoading(false);
    }
  }, [device.id, dateRange, historicalData]);

  // Fetch data when component mounts or date range changes
  useEffect(() => {
    fetchHistoricalData();
  }, [fetchHistoricalData]);

  const handleDateRangeChange = (field, value) => {
    setDateRange((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const formatTooltipLabel = (value) => {
    return new Date(value).toLocaleString();
  };

  // Quick date range presets
  const setQuickRange = (hours) => {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - hours * 60 * 60 * 1000);

    setDateRange({
      startDate: startDate.toISOString().slice(0, 16),
      endDate: endDate.toISOString().slice(0, 16),
    });
  };

  return (
    <div className="historical-data-section">
      <h4 className="historical-title">Historical Power Usage</h4>

      {/* Quick Range Buttons */}
      <div className="quick-range-buttons">
        <button onClick={() => setQuickRange(1)} className="quick-range-btn">
          Last Hour
        </button>
        <button onClick={() => setQuickRange(6)} className="quick-range-btn">
          Last 6 Hours
        </button>
        <button onClick={() => setQuickRange(24)} className="quick-range-btn">
          Last 24 Hours
        </button>
        <button onClick={() => setQuickRange(168)} className="quick-range-btn">
          Last Week
        </button>
      </div>

      {/* Date Range Controls */}
      <div className="date-range-controls">
        <div className="date-input-group">
          <label>From:</label>
          <input
            type="datetime-local"
            value={dateRange.startDate}
            onChange={(e) => handleDateRangeChange("startDate", e.target.value)}
            className="date-input"
          />
        </div>
        <div className="date-input-group">
          <label>To:</label>
          <input
            type="datetime-local"
            value={dateRange.endDate}
            onChange={(e) => handleDateRangeChange("endDate", e.target.value)}
            className="date-input"
          />
        </div>

        {/* View Type Selector */}
        <div className="view-type-group">
          <label>View:</label>
          <select
            value={viewType}
            onChange={(e) => setViewType(e.target.value)}
            className="view-type-select"
          >
            <option value="power">Power Only</option>
            <option value="voltage">Voltage Only</option>
            <option value="current">Current Only</option>
            <option value="all">All Metrics</option>
          </select>
        </div>

        <div className="refresh-button-group">
          <button
            onClick={fetchHistoricalData}
            className="refresh-btn"
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <p>⚠️ {error}</p>
          <p>Showing real-time data instead.</p>
        </div>
      )}

      {/* Historical Chart */}
      <div className="historical-chart-container">
        {loading ? (
          <div className="loading-message">
            <p>📈 Loading historical data...</p>
          </div>
        ) : historicalChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={historicalChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                interval="preserveStartEnd"
                angle={-45}
                textAnchor="end"
                height={60}
                tick={{ fontSize: 12 }}
              />
              <YAxis yAxisId="left" />
              {(viewType === "all" ||
                viewType === "voltage" ||
                viewType === "current") && (
                <YAxis yAxisId="right" orientation="right" />
              )}
              <Tooltip
                labelFormatter={(label) => `Time: ${label}`}
                formatter={(value, name) => [value, name]}
              />
              <Legend />

              {(viewType === "power" || viewType === "all") && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="power"
                  stroke="#8884d8"
                  strokeWidth={2}
                  name="Power (W)"
                  dot={false}
                />
              )}

              {(viewType === "voltage" || viewType === "all") && (
                <Line
                  yAxisId={viewType === "all" ? "right" : "left"}
                  type="monotone"
                  dataKey="voltage"
                  stroke="#82ca9d"
                  strokeWidth={2}
                  name="Voltage (V)"
                  dot={false}
                />
              )}

              {(viewType === "current" || viewType === "all") && (
                <Line
                  yAxisId={viewType === "all" ? "right" : "left"}
                  type="monotone"
                  dataKey="current"
                  stroke="#ffc658"
                  strokeWidth={2}
                  name="Current (mA)"
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="no-data-message">
            <p>No historical data available for the selected date range.</p>
            <p>
              Try selecting a different time period or ensure the device has
              been collecting data.
            </p>
          </div>
        )}
      </div>

      {/* Data Summary */}
      {historicalChartData.length > 0 && !loading && (
        <div className="data-summary">
          <div className="summary-stats">
            <div className="stat-item">
              <span className="stat-label">Data Points:</span>
              <span className="stat-value">{historicalChartData.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Average Power:</span>
              <span className="stat-value">
                {(
                  historicalChartData.reduce(
                    (sum, d) => sum + (d.power || 0),
                    0
                  ) / historicalChartData.length
                ).toFixed(1)}
                W
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Max Power:</span>
              <span className="stat-value">
                {Math.max(
                  ...historicalChartData.map((d) => d.power || 0)
                ).toFixed(1)}
                W
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Min Power:</span>
              <span className="stat-value">
                {Math.min(
                  ...historicalChartData.map((d) => d.power || 0)
                ).toFixed(1)}
                W
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Energy Period:</span>
              <span className="stat-value">
                {(
                  ((historicalChartData.reduce(
                    (sum, d) => sum + (d.power || 0),
                    0
                  ) /
                    historicalChartData.length) *
                    historicalChartData.length *
                    5) /
                  60 /
                  1000
                ).toFixed(3)}
                kWh
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DeviceListItem = React.memo(
  ({ device, onToggle, onRemove, isExpanded, onExpand, historicalData }) => {
    const getStatusColor = () => {
      if (device.connected === false || device.connected === undefined)
        return "#dc3545";
      return device.power_state ? "#28a745" : "#6c757d";
    };

    const getStatusText = () => {
      if (device.connected === false || device.connected === undefined)
        return "Disconnected";
      return device.power_state ? "ON" : "OFF";
    };

    return (
      <div
        className={`device-list-item ${isExpanded ? "expanded" : ""}`}
        onClick={() => onExpand(device.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onExpand(device.id);
          }
        }}
      >
        <div className="device-summary">
          <div className="device-basic-info">
            <div className="device-name-room">
              <h3>{device.name}</h3>
              <span className="device-room">{device.room}</span>
            </div>
            <div className="device-type">{device.type.replace("_", " ")}</div>
          </div>

          <div className="device-status-section">
            <div className="device-status">
              <div
                className="status-indicator"
                style={{ backgroundColor: getStatusColor() }}
              ></div>
              <span className="status-text">{getStatusText()}</span>
            </div>

            <div
              className="quick-controls"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className={`toggle-btn-small ${
                  device.power_state ? "on" : "off"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log("Toggle button clicked for device:", device.id);
                  onToggle(device.id);
                }}
                disabled={device.connected === false}
                data-state={device.power_state ? "ON" : "OFF"}
                title={`Turn ${device.power_state ? "OFF" : "ON"}`}
              >
                {/* Visual toggle switch - text shown via CSS */}
              </button>
            </div>

            <button
              className="remove-btn-small"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(device.id);
              }}
              title="Remove Device"
            >
              ×
            </button>

            <div className="expand-arrow">{isExpanded ? "▼" : "▶"}</div>
          </div>
        </div>

        {isExpanded && (
          <div className="device-details">
            <div className="device-metrics-grid">
              <div className="metric-item">
                <span className="metric-label">Voltage</span>
                <span className="metric-value">
                  {device.connected ? device.voltage?.toFixed(1) || 0 : "N/A"}V
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Current</span>
                <span className="metric-value">
                  {device.connected ? device.current || 0 : "N/A"}mA
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Power</span>
                <span className="metric-value">
                  {device.connected ? device.power?.toFixed(1) || 0 : "N/A"}W
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Energy</span>
                <span className="metric-value">
                  {device.connected ? device.energy?.toFixed(3) || 0 : "N/A"}kWh
                </span>
              </div>
            </div>

            {device.connected && (
              <div className="billing-section">
                <h4 className="billing-title">
                  Billing Information (Bangladesh)
                </h4>
                <div className="billing-grid">
                  <div className="billing-item">
                    <span className="billing-label">
                      Total Cost (Progressive)
                    </span>
                    <span className="billing-value billing-cost">
                      ৳{calculateBillingCost(device.energy || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="billing-item">
                    <span className="billing-label">Real-time Cost/Hour</span>
                    <span className="billing-value billing-realtime">
                      ৳{calculateRealTimeCost(device.power || 0).toFixed(2)}/hr
                    </span>
                  </div>
                </div>
              </div>
            )}

            {device.connected && historicalData && (
              <HistoricalDataViewer
                device={device}
                historicalData={historicalData}
              />
            )}

            <div className="device-info-grid">
              <div className="info-item">
                <span className="info-label">IP Address:</span>
                <span className="info-value">{device.ip || "N/A"}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Last Update:</span>
                <span className="info-value">
                  {device.timestamp
                    ? new Date(device.timestamp).toLocaleTimeString()
                    : "Never"}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Device ID:</span>
                <span className="info-value">{device.device_id || "N/A"}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Version:</span>
                <span className="info-value">{device.version || "N/A"}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

const AddDeviceModal = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    device_id: "",
    device_key: "",
    device_ip: "",
    version: "3.4",
    type: "smart_plug",
    room: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd(formData);
    setFormData({
      id: "",
      name: "",
      device_id: "",
      device_key: "",
      device_ip: "",
      version: "3.4",
      type: "smart_plug",
      room: "",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>Add New Device</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Device ID (Unique):</label>
            <input
              type="text"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              required
              placeholder="e.g., device_2"
            />
          </div>
          <div className="form-group">
            <label>Device Name:</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
              placeholder="e.g., Kitchen Smart Plug"
            />
          </div>
          <div className="form-group">
            <label>Tuya Device ID:</label>
            <input
              type="text"
              value={formData.device_id}
              onChange={(e) =>
                setFormData({ ...formData, device_id: e.target.value })
              }
              required
              placeholder="Device ID from Tuya CLI"
            />
          </div>
          <div className="form-group">
            <label>Device Key:</label>
            <input
              type="text"
              value={formData.device_key}
              onChange={(e) =>
                setFormData({ ...formData, device_key: e.target.value })
              }
              required
              placeholder="Device key from Tuya CLI"
            />
          </div>
          <div className="form-group">
            <label>Device IP:</label>
            <input
              type="text"
              value={formData.device_ip}
              onChange={(e) =>
                setFormData({ ...formData, device_ip: e.target.value })
              }
              required
              placeholder="192.168.1.100"
            />
          </div>
          <div className="form-group">
            <label>Protocol Version:</label>
            <select
              value={formData.version}
              onChange={(e) =>
                setFormData({ ...formData, version: e.target.value })
              }
            >
              <option value="3.1">3.1</option>
              <option value="3.3">3.3</option>
              <option value="3.4">3.4</option>
            </select>
          </div>
          <div className="form-group">
            <label>Device Type:</label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value })
              }
            >
              <option value="smart_plug">Smart Plug</option>
              <option value="smart_switch">Smart Switch</option>
              <option value="smart_outlet">Smart Outlet</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label>Room:</label>
            <input
              type="text"
              value={formData.room}
              onChange={(e) =>
                setFormData({ ...formData, room: e.target.value })
              }
              placeholder="e.g., Kitchen"
            />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" className="submit-button">
              Add Device
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const App = () => {
  const [devices, setDevices] = useState([]);
  const [historicalData, setHistoricalData] = useState(new Map());
  const [ws, setWs] = useState(null);
  const [connecting, setConnecting] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [expandedDevices, setExpandedDevices] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [showDisabledDevices, setShowDisabledDevices] = useState(true);

  const connectWebSocket = useCallback(() => {
    if (ws) {
      ws.close();
    }

    // Dynamic WebSocket URL for development and production
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let wsHost;

    // Check if we're in development mode (React dev server on port 3000)
    if (window.location.port === "3000") {
      // Development mode: connect to backend server on port 5000
      wsHost = "localhost:5000";
    } else {
      // Production mode: use same host:port as the webpage (for ngrok compatibility)
      wsHost = window.location.host;
    }

    const wsUrl = `${wsProtocol}//${wsHost}`;

    const websocket = new WebSocket(wsUrl);
    websocket.onopen = () => {
      console.log("Connected to WebSocket");
      setConnecting(false);
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("Received message:", message);

        if (message.type === "initial_data") {
          console.log("Setting devices:", message.data.length, "devices");
          setDevices(message.data);
        }

        if (message.type === "device_data") {
          setDevices((prev) => {
            const updated = prev.map((device) =>
              device.id === message.deviceId ? message.data : device
            );

            // If device doesn't exist, add it
            if (!prev.find((d) => d.id === message.deviceId)) {
              updated.push(message.data);
            }

            return updated;
          });

          // Update historical data
          setHistoricalData((prev) => {
            const newMap = new Map(prev);
            const deviceHistory = newMap.get(message.deviceId) || [];
            const timestamp = new Date(message.data.timestamp);
            const newPoint = {
              time: timestamp.toLocaleTimeString(),
              fullTimestamp: timestamp.toISOString(),
              timestamp: timestamp.getTime(), // for chart sorting
              power: parseFloat(message.data.power) || 0,
              current: parseFloat(message.data.current) || 0,
              voltage: parseFloat(message.data.voltage) || 0,
            };

            const updatedHistory = [...deviceHistory, newPoint].slice(-200); // Keep more data for historical view
            newMap.set(message.deviceId, updatedHistory);
            return newMap;
          });
        }

        if (
          message.type === "device_connect" ||
          message.type === "device_disconnect"
        ) {
          setDevices((prev) =>
            prev.map((device) =>
              device.id === message.deviceId
                ? { ...device, connected: message.type === "device_connect" }
                : device
            )
          );
        }

        if (message.type === "device_removed") {
          setDevices((prev) =>
            prev.filter((device) => device.id !== message.deviceId)
          );
          setHistoricalData((prev) => {
            const newMap = new Map(prev);
            newMap.delete(message.deviceId);
            return newMap;
          });
        }

        if (message.type === "error") {
          console.error("Server error:", message.data?.error);
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
  }, []);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [connectWebSocket]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && searchTerm) {
        setSearchTerm("");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchTerm]);

  const toggleDevice = (deviceId) => {
    console.log("toggleDevice called for:", deviceId);
    console.log("WebSocket state:", ws ? ws.readyState : "no websocket");

    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log("Sending toggle command for device:", deviceId);
      ws.send(JSON.stringify({ type: "toggle", deviceId }));
    } else {
      console.warn("WebSocket not ready, cannot send toggle command");
      // Fallback: try REST API
      fetch(`/api/devices/${deviceId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
        .then((response) => response.json())
        .then((data) => console.log("REST toggle result:", data))
        .catch((error) => console.error("REST toggle failed:", error));
    }
  };

  const toggleExpanded = (deviceId) => {
    setExpandedDevices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(deviceId)) {
        newSet.delete(deviceId);
      } else {
        newSet.add(deviceId);
      }
      return newSet;
    });
  };

  const removeDevice = async (deviceId) => {
    if (window.confirm("Are you sure you want to remove this device?")) {
      try {
        const response = await fetch(`/api/devices/${deviceId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          console.log("Device removed successfully");
          // Remove from expanded devices if it was expanded
          setExpandedDevices((prev) => {
            const newSet = new Set(prev);
            newSet.delete(deviceId);
            return newSet;
          });
        } else {
          const error = await response.json();
          console.error("Failed to remove device:", error.error);
          alert("Failed to remove device: " + error.error);
        }
      } catch (error) {
        console.error("Error removing device:", error);
        alert("Error removing device: " + error.message);
      }
    }
  };

  const addDevice = async (deviceData) => {
    try {
      const response = await fetch("/api/devices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(deviceData),
      });

      if (response.ok) {
        console.log("Device added successfully");
        setShowAddModal(false);
      } else {
        const error = await response.json();
        alert("Error adding device: " + error.error);
      }
    } catch (error) {
      console.error("Error adding device:", error);
      alert("Error adding device: " + error.message);
    }
  };

  const refreshData = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "refresh" }));
    }
  };

  if (connecting) {
    return (
      <div className="loading">
        <h2>Connecting to Tuya Device Dashboard...</h2>
        <p>Please wait while we establish connections</p>
      </div>
    );
  }

  const connectedDevices = devices.filter((d) => d.connected === true).length;
  const totalDevices = devices.length;
  const enabledDevices = devices.filter((d) => d.enabled === true).length;
  const disabledDevices = devices.filter((d) => d.enabled === false).length;

  // Filter devices based on search term and disabled device visibility
  const filteredDevices = devices.filter((device) => {
    // Filter by disabled device visibility
    const isDisabledDevice = device.enabled === false;
    if (isDisabledDevice && !showDisabledDevices) {
      return false;
    }

    // Filter by search term
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      device.name.toLowerCase().includes(searchLower) ||
      device.room.toLowerCase().includes(searchLower) ||
      device.type.toLowerCase().includes(searchLower) ||
      device.id.toLowerCase().includes(searchLower)
    );
  });

  const expandAll = () => {
    const allDeviceIds = new Set(filteredDevices.map((device) => device.id));
    setExpandedDevices(allDeviceIds);
  };

  const collapseAll = () => {
    setExpandedDevices(new Set());
  };

  // Function to open README.md in new tab
  const openInstallationGuide = () => {
    window.open("/README.md", "_blank");
  };

  return (
    <div className="dashboard">
      {/* Header (kept full width) */}
      <div className="header">
        <div className="header-content">
          <h1>Smart Home Device Dashboard</h1>
          <button
            className="installation-guide-btn"
            onClick={openInstallationGuide}
          >
            Installation Guide
          </button>
        </div>
      </div>

      <div className="dashboard-layout">
        {/* LEFT: Devices */}
        <div className="devices-column">
          {devices.length === 0 ? (
            <div className="no-devices">
              <h3>No devices configured</h3>
              <p>Click "Add Device" to start monitoring your Tuya devices</p>
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="no-devices">
              <h3>No devices match your search criteria</h3>
              <p>Try adjusting your search term or filters</p>
            </div>
          ) : (
            <div className="devices-list">
              {filteredDevices.map((device) => (
                <DeviceListItem
                  key={device.id}
                  device={device}
                  onToggle={toggleDevice}
                  onRemove={removeDevice}
                  isExpanded={expandedDevices.has(device.id)}
                  onExpand={toggleExpanded}
                  historicalData={historicalData.get(device.id) || []}
                />
              ))}
            </div>
          )}

          {selectedDevice && historicalData.get(selectedDevice.id) && (
            <div className="chart-section">
              <h3>
                Historical Data -{" "}
                {devices.find((d) => d.id === selectedDevice.id)?.name}
              </h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={historicalData.get(selectedDevice.id)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="time"
                      interval="preserveStartEnd"
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip labelFormatter={(label) => `Time: ${label}`} />
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
          )}
        </div>

        {/* RIGHT: Controls & Stats */}
        <div className="controls-column">
          <div className="controls-panel">
            <div className="panel-section">
              <h4 className="panel-title">Actions</h4>
              <div className="dashboard-actions stacked">
                <button
                  className="action-button"
                  onClick={() => setShowAddModal(true)}
                >
                  Add Device
                </button>
                <button className="action-button" onClick={refreshData}>
                  Refresh All
                </button>
                <button
                  className={`action-button ${
                    showDisabledDevices ? "active" : ""
                  }`}
                  onClick={() => setShowDisabledDevices(!showDisabledDevices)}
                  title={
                    showDisabledDevices
                      ? "Hide disabled devices"
                      : "Show disabled devices"
                  }
                >
                  {showDisabledDevices ? "Hide" : "Show"} Disabled (
                  {disabledDevices})
                </button>
              </div>
            </div>

            {devices.length > 0 && (
              <div className="panel-section device-filters inline-embed">
                <h4 className="panel-title">Search & Filter</h4>
                <div className="search-container">
                  <div className="search-input-wrapper">
                    <input
                      type="text"
                      placeholder="Search devices (Esc to clear)"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input"
                    />
                    {searchTerm && (
                      <button
                        className="clear-search"
                        onClick={() => setSearchTerm("")}
                        title="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                <div className="filter-controls single-row">
                  <div className="results-count">
                    {filteredDevices.length} / {totalDevices} shown
                  </div>
                  {filteredDevices.length > 0 && (
                    <div className="expand-controls">
                      <button className="expand-btn" onClick={expandAll}>
                        Expand All
                      </button>
                      <button className="expand-btn" onClick={collapseAll}>
                        Collapse All
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="panel-section">
              <h4 className="panel-title">Stats</h4>
              <div className="dashboard-stats side compact">
                <div className="stat">
                  <span className="stat-value">{connectedDevices}</span>
                  <span className="stat-label">Connected</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{enabledDevices}</span>
                  <span className="stat-label">Enabled</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{disabledDevices}</span>
                  <span className="stat-label">Disabled</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{totalDevices}</span>
                  <span className="stat-label">Total</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddDeviceModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={addDevice}
      />
    </div>
  );
};

export default App;
