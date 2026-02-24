import { useState, useEffect } from 'react'
import MapView from "./components/MapView";
import UIOverlay from "./components/UIOverlay";
import Splash from "./components/Splash";
import './styles.css'

export default function App() {
  const [started, setStarted] = useState(false);
  const [hideSplash, setHideSplash] = useState(false);

  const begin = () => {
  setHideSplash(true);

  window.setTimeout(() => {
    setStarted(true);
  }, 300);
};

  const [darkMode, setDarkMode] = useState(localStorage.getItem("theme") === "true");
  const [renderStops, setRenderStops] = useState(localStorage.getItem("stops") !== "false");
  const [renderVehicles, setRenderVehicles] = useState(localStorage.getItem("busses") !== "false");
  const [showOptions, setShowOptions] = useState(localStorage.getItem("showOptions") === "true");

  const [dataPanelOpen, setDataPanelOpen] = useState(false);

  const [warningText, setWarningText] = useState("");

  const [selectedStop, setSelectedStop] = useState(null);
  const [arrivalsData, setArrivalsData] = useState(null);

  const [routesLoading, setRoutesLoading] = useState(true);

  const [highlightedRoute, setHighlightedRoute] = useState(null);
  const [routeQuery, setRouteQuery] = useState("");

  useEffect(() => localStorage.setItem("theme", String(darkMode)), [darkMode]);
  useEffect(() => localStorage.setItem("stops", String(renderStops)), [renderStops]);
  useEffect(() => localStorage.setItem("busses", String(renderVehicles)), [renderVehicles]);
  useEffect(() => localStorage.setItem("showOptions", String(showOptions)), [showOptions]);

  useEffect(() => {
    let intervalId;

    setArrivalsData(null);

    async function loadArrivals() {
      if (!selectedStop) return;

      const res = await fetch(
        `/api/arrivals?stop_id=${selectedStop.agency}_${selectedStop.stop_id}`
      );
      const data = await res.json();
      setArrivalsData(data);
    }

    if (!selectedStop) return;

    loadArrivals();
    intervalId = window.setInterval(loadArrivals, 30000);

    return () => clearInterval(intervalId);
  }, [selectedStop]);

  const onSubmitRoute = () => {
    const input = routeQuery.trim();
    if (!input) {
      setHighlightedRoute(null);
      return;
    }
    setHighlightedRoute(input);
    setRouteQuery("");
  };

  const clearSelection = () => {
    setHighlightedRoute(null);
    setDataPanelOpen(false);

    window.setTimeout(() => {
      setSelectedStop(null);
      setArrivalsData(null);
    }, 400);
  };

  useEffect(() => {
    if (selectedStop) {
      setDataPanelOpen(true);
    }
  }, [selectedStop]);

  return (
    <>
      {!started && (
      <Splash
        darkMode={darkMode}
        hidden={hideSplash}
        onClick={begin}
      />
      )}

      <UIOverlay
        started={started}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        showOptions={showOptions}
        setShowOptions={setShowOptions}
        renderStops={renderStops}
        setRenderStops={setRenderStops}
        renderVehicles={renderVehicles}
        setRenderVehicles={setRenderVehicles}
        routeQuery={routeQuery}
        setRouteQuery={setRouteQuery}
        onSubmitRoute={onSubmitRoute}
        highlightedRoute={highlightedRoute}
        selectedStop={selectedStop}
        arrivalsData={arrivalsData}
        warningText={warningText}
        routesLoading={routesLoading}
        dataPanelOpen={dataPanelOpen}
      />

      <MapView
        darkMode={darkMode}
        renderStops={renderStops}
        renderVehicles={renderVehicles}
        selectedStop={selectedStop}
        setSelectedStop={setSelectedStop}
        highlightedRoute={highlightedRoute}
        onMapClick={clearSelection}
        setWarningText={setWarningText}
        setRoutesLoading={setRoutesLoading}
      />
    </>
  );
}
