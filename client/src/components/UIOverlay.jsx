// src/components/UIOverlay.jsx
import React from "react";

export default function UIOverlay({
    darkMode,
    setDarkMode,
    renderStops,
    setRenderStops,
    renderVehicles,
    setRenderVehicles,
}) {
    return (
        <div style={{
            position: "absolute",
            top: 10,
            left: 10,
            zIndex: 5000,
            background: "rgba(255,255,255,0.9)",
            padding: "10px",
            borderRadius: "6px"
        }}>
        <h4>Map Controls</h4>
        <label>
            <input 
                type="checkbox" 
                checked={darkMode} 
                onChange={e => setDarkMode(e.target.checked)} 
            /> Dark Mode
        </label>
        <br/>
        <label>
            <input 
                type="checkbox" 
                checked={renderStops} 
                onChange={e => setRenderStops(e.target.checked)} 
            /> Show Stops
        </label>
        <br />
        <label>
            <input 
            type="checkbox" 
            checked={renderVehicles} 
            onChange={e => setRenderVehicles(e.target.checked)} 
            /> Show Vehicles
        </label>
        </div>
    );
}