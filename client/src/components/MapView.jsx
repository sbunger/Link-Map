import { useEffect, useRef } from "react";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import "leaflet.markercluster";
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

export default function MapView({
    darkMode,
    renderStops,
    renderVehicles,
    selectedStop,
    setSelectedStop,
    highlightedRoute
}) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const layers = useRef({});
    const routeLines = useRef([]);

    let stopIcon = L.icon({
        iconUrl: "/images/stop-icon.png",
        iconSize: [24, 24],
        opacity: 0.8,
    });

    let selectedStopIcon = L.icon({
        iconUrl: '/images/selected-stop-icon.png',
        iconSize: [34, 34],
        opacity: 0.8,
    });

    const busIcon = L.icon({
        iconUrl: "/images/bus.png",
        iconSize: [24, 24],
    });

    const linkIcon = L.icon({
        iconUrl: "/images/rail.png",
        iconSize: [26, 26],
    });

    //map
    useEffect(() => {
        if (mapInstance.current) return;

        const map = L.map(mapRef.current, {
            center: [47.6, -122.33],
            zoom: 13,
            preferCanvas: true,
            zoomControl: false,
            maxZoom: 18
        });

        mapInstance.current = map;

        map.createPane("vehiclePane");
        map.getPane("vehiclePane").style.zIndex = 4000;

        layers.current = {
            stopLayer: L.layerGroup().addTo(map),
            routeLayer: L.layerGroup().addTo(map),
            railLayer: L.layerGroup().addTo(map),
            busLayer: L.markerClusterGroup({
                spiderfyOnMaxZoom: false,
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true,
                maxClusterRadius: 45,
                pane: 'vehiclePane',
                iconCreateFunction: cluster => L.divIcon({
                    html: `<div class="cluster-count">${cluster.getChildCount()}</div>`,
                    className: 'bus-cluster',
                    iconSize: [30, 30]
                })
            }).addTo(map)
        };

        map.on("click", () => {
            setSelectedStop(null);
        });
    }, []);

    //dark or light mode
    useEffect(() => {
        const map =mapInstance.current;
        if (!map) return;

        map.eachLayer(layer => {
            if (layer instanceof L.TileLayer) {
                map.removeLayer(layer);
            }
        });

        const tileUrl = darkMode
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

        L.tileLayer(tileUrl, {
            attribution: "&copy; CARTO"
        }).addTo(map);

    }, [darkMode]);

    //routes
    useEffect(() => {
        const map = mapInstance.current;
        if (!map) return;

        
        const loadRoutes = async () => {
            try {
                const res = await fetch("/api/routes-nearby");
                const routes = await res.json();

                layers.current.routeLayer.clearLayers();
                routeLines.current = [];

                routes.forEach(routeShape => {
                    routeShape.shape.sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence);
                    const coords = routeShape.shape.map(p => [p.shape_pt_lat, p.shape_pt_lon]);

                    const isRail = routeShape.route_type === 0 && routeShape.agency_id.startsWith("st_");
                    const color = isRail ? "#f14377" : routeShape.route_color || "#6FADCA";

                    const line = L.polyline(coords, {
                        color,
                        weight: 4,
                        opacity: 0.4
                    }).addTo(layers.current.routeLayer);

                    line.routeId = routeShape.route_id;
                    line.routeName = routeShape.name || "Unnamed Route";
                    line.isRail = isRail;

                    routeLines.current.push(line);
                });
            } catch (err) {
                console.error("Route load error:", err);
            }
        };

        loadRoutes();

    }, []);

    //highlight route
    useEffect(() => {
        routeLines.current.forEach(line => {
            if (!highlightedRoute) {
                line.setStyle({ opacity: line.isRail ? 0.8 : 0.4 });
            } else if (line.routeName === highlightedRoute) {
                line.setStyle({ opacity: 0.9, weight: 6 });
                
                const group = L.featureGroup([line]);
                mapInstance.current.flyToBounds(group.getBounds(), { padding: [50, 50] });

            } else {
                line.setStyle({ opacity: 0.15 });
            }
        });
    }, [highlightedRoute]);

    //stops
    useEffect(() => {
        const map = mapInstance.current;
        if (!map) return;

        layers.current.stopLayer.clearLayers();
        if (!renderStops) return;

        const loadStops = () => {
            const bounds = map.getBounds();

            fetch(`/api/stops-nearby?bbox=${bounds.toBBoxString()}`)
                .then(res => res.json())
                .then(stops => {
                    layers.current.stopLayer.clearLayers();

                    if (stops.length > 850) return;

                    stops.forEach(stop => {
                        const marker = L.marker([stop.lat, stop.lon], { icon: stopIcon });

                        marker.on("click", e => {
                            L.DomEvent.stopPropagation(e);
                            setSelectedStop(stop);
                        });

                        layers.current.stopLayer.addLayer(marker);
                    });
                })
                .catch(err => console.error("Stop load error:", err));
        };

        loadStops();

        map.on("moveend", loadStops);

        return () => {
            map.off("moveend", loadStops);
        };

    }, [renderStops]);

    //vehicles
    useEffect(() => {
        const map = mapInstance.current;
        if (!map) return;

        const loadVehicles = async () => {
            try {
                const res = await fetch("/api/vehicles");
                const vehicles = await res.json();

                const newBusLayer = L.layerGroup();
                const newRailLayer = L.layerGroup();

                vehicles.forEach(v => {
                    if (!v.lat || !v.lon) return;
                    const marker = L.marker([v.lat, v.lon], {
                        icon: (v.type === 0) ? linkIcon : busIcon,
                        pane: 'vehiclePane',
                        interactive: false
                    });

                    if (v.type === 0) {
                        newRailLayer.addLayer(marker);
                    } else {
                        newBusLayer.addLayer(marker);
                    }
                });

                layers.current.busLayer.clearLayers();
                layers.current.railLayer.clearLayers();

                layers.current.railLayer.addLayer(newRailLayer);
                
                if (renderVehicles) {
                    layers.current.busLayer.addLayer(newBusLayer);
                };
            } catch (err) {
                console.error("Vehicle load error:", err);
            }
        };

        loadVehicles();
        const interval = setInterval(loadVehicles, 15000);
        return () => clearInterval(interval);
    }, [renderVehicles]);

    return <div ref={mapRef} style={{ height: "100vh", width: "100vw" }} />;
}