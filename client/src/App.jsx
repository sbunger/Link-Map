import { useState } from 'react'
import MapView from "./components/MapView";
import './styles.css'

export default function App() {
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("theme") === "true"
  );

  const [renderStops, setRenderStops] = useState(
    localStorage.getItem("stops") !== "false"
  );

  const [renderVehicles, setRenderVehicles] = useState(
    localStorage.getItem("busses") !== "false"
  );

  const [selectedStop, setSelectedStop] = useState(null);
  const [highlightedRoute, setHighlightedRoute] = useState(null);

  return (
    <>
      

      <MapView
        darkMode={darkMode}
        renderStops={renderStops}
        renderVehicles={renderVehicles}
        selectedStop={selectedStop}
        setSelectedStop={setSelectedStop}
        highlightedRoute={highlightedRoute}
      />
    </>
  );
}
