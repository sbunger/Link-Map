import { useEffect, useMemo, useRef } from "react";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import "leaflet.markercluster";
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import '../styles.css'

export default function MapView({
    darkMode,
    renderStops,
    renderVehicles,
    selectedStop,
    setSelectedStop,
    highlightedRoute,
    onMapClick,
    setWarningText,
    setRoutesLoading
}) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const layers = useRef({});
    const routeLines = useRef([]);

    const hoverTooltipRef = useRef(null);
    const hoverTimeoutRef = useRef(null);

    function isNearLine(map, latlng, polyline, tolerance = 8) {
        const point = map.latLngToLayerPoint(latlng);

        for (let i = 0; i < polyline.latLngs.length - 1; i++) {
            const p1 = map.latLngToLayerPoint(polyline.latLngs[i]);
            const p2 = map.latLngToLayerPoint(polyline.latLngs[i + 1]);
            if (L.LineUtil.pointToSegmentDistance(point, p1, p2) <= tolerance) return true;
        }
        return false;
    }

    function isLineVisible(line, bounds) {
        return line.latLngs?.some(ll => bounds.contains(ll));
    }

    const stopIconLight = useMemo(
        () =>
            L.icon({
                iconUrl: "/images/map/stop-icon.png",
                iconSize: [24, 24]
            }),
        []
    );

    const stopIconDark = useMemo(
        () =>
            L.icon({
                iconUrl: "/images/map/stop-icon-dark.png",
                iconSize: [24, 24]
            }),
        []
    );

    
    const selectedStopIconLight = useMemo(
        () =>
            L.icon({
                iconUrl: "/images/map/selected-stop-icon.png",
                iconSize: [28, 28]
            }),
        []
    );

    const selectedStopIconDark = useMemo(
        () =>
            L.icon({
                iconUrl: "/images/map/selected-stop-icon-dark.png",
                iconSize: [28, 28]
            }),
        []
    );

    const busIcon = useMemo(
        () =>
            L.icon({
                iconUrl: "/images/map/bus.png",
                iconSize: [24, 24],
            }),
        []
    );

    const linkIcon = useMemo(
        () =>
            L.icon({
                iconUrl: "/images/map/rail.png",
                iconSize: [26, 26],
            }),
        []
    );


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
        map.getPane("vehiclePane").style.zIndex = 850;

        hoverTooltipRef.current = L.tooltip({ sticky: true, className: "route-tooltip" });

        layers.current = {
            stopLayer: L.layerGroup().addTo(map),
            selectedStopLayer: L.layerGroup().addTo(map),
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
            onMapClick?.();
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
            setRoutesLoading?.(true);

            try {
                const res = await fetch("/api/routes-nearby");
                const routes = await res.json();

                layers.current.routeLayer.clearLayers();
                routeLines.current = [];

                routes.forEach(routeShape => {
                    routeShape.shape.sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence);
                    const coords = routeShape.shape.map(p => [p.shape_pt_lat, p.shape_pt_lon]);

                    const isRail = routeShape.route_type === 0 && routeShape.agency_id.startsWith("st_");
                    const color = isRail ? "#f14377" : getMappedColor(routeShape.route_color);

                    const line = L.polyline(coords, {
                        color,
                        weight: 4,
                        opacity: isRail ? 0.8 : 0.4
                    }).addTo(layers.current.routeLayer);

                    line.routeName = routeShape.name ?? "Unnamed Route"; 
                    line.latLngs = line.getLatLngs();
                    line.routeId = routeShape.route_id;
                    line.color = color;
                    line.isRail = isRail;

                    layers.current.routeLayer.addLayer(line);
                    routeLines.current.push(line);
                });
            } catch (err) {
                console.error("Route load error:", err);
            } finally {
                setRoutesLoading?.(false);
            }
        };

        loadRoutes();

    }, [setRoutesLoading]);

    //route colors
    let colorMap = {};
    let paletteIndex = 0;
    const palette = [
        "#6FADCA", // kc metro
        "#2f4eb3", // soundtransit i think?
        "#2f4eb3", // kc water taxi
        "#2f4eb3", // vashon ferry
        "#f14377",  // streetcars
        "#f14377", // rapidride
    ];

    const getMappedColor = (original) => {
        if (!original) return "#6FADCA";

        if (!colorMap[original]) {
            colorMap[original] = palette[paletteIndex % palette.length]
            paletteIndex++;
        }

        return colorMap[original];
    }

    //highlight route
    useEffect(() => {
        let found = false;

        routeLines.current.forEach(line => {
            if (!highlightedRoute) {
                line.setStyle({ opacity: line.isRail ? 0.8 : 0.4 });
            } else if (line.routeName.toLowerCase() === highlightedRoute.toLowerCase()) {
                line.setStyle({ opacity: 0.9});
                found = true;
                
                const group = L.featureGroup([line]);
                mapInstance.current.flyToBounds(group.getBounds(), { padding: [50, 50] });

            } else {
                line.setStyle({ opacity: 0.1 });
            }
        });

        if (found == false) {
            highlightedRoute = null;
            routeLines.current.forEach(line => {
                line.setStyle({ opacity: line.isRail ? 0.8 : 0.4 });
            });
        }
    }, [highlightedRoute]);

    //tooltip
    useEffect(() => {
        const map = mapInstance.current;
        if (!map) return;

        const onMouseMove = (e) => {
            const tooltip = hoverTooltipRef.current;
            if (!tooltip) return;

            tooltip.setLatLng(e.latlng);

            if (hoverTimeoutRef.current) return;

            hoverTimeoutRef.current = window.setTimeout(() => {
                hoverTimeoutRef.current = null;

                const bounds = map.getBounds();
                const hits = routeLines.current
                    .filter(line => isLineVisible(line, bounds))
                    .filter(line => isNearLine(map, e.latlng, line, 8));

                if (hits.length) {
                    tooltip
                        .setContent(hits.map(l => l.routeName).join(", "))
                        .addTo(map);
                } else {
                    if (map.hasLayer(tooltip)) map.removeLayer(tooltip);
                }
            }, 100);
        };

        map.on("mousemove", onMouseMove);

        return () => {
            map.off("mousemove", onMouseMove);

            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
                hoverTimeoutRef.current = null;
            }
            const tooltip = hoverTooltipRef.current;
            if (tooltip && map.hasLayer(tooltip)) map.removeLayer(tooltip);
        };
    }, []);

    //stops
    useEffect(() => {
        const map = mapInstance.current;
        if (!map) return;

        if (!renderStops) {
            layers.current.stopLayer.clearLayers();
            layers.current.selectedStopLayer.clearLayers();
            return;
        };

        const loadStops = () => {
            const bounds = map.getBounds();

            fetch(`/api/stops-nearby?bbox=${bounds.toBBoxString()}`)
                .then(res => res.json())
                .then(stops => {
                    if (stops.length > 850) {
                        setWarningText?.("Zoom in to view stops!");
                        layers.current.stopLayer.clearLayers();
                        layers.current.selectedStopLayer.clearLayers();
                    } else {
                        setWarningText?.("");
                    }

                    const newStopLayer = L.layerGroup();
                    const newSelectedStopLayer = L.layerGroup();

                    stops.forEach(stop => {

                        //clean up ST data
                        if ((stop.stop_id.includes("LS") || stop.stop_id.includes("C") || stop.name.toLowerCase().includes("entrance") || stop.name.toLowerCase().includes("bay"))  && !(stop.agency == "1")) return;
                        if ((stop.stop_id.length === 3 || stop.stop_id.length === 4) && !(stop.agency == "1")) return;
                        if ((stop.name.includes("&")) && !(stop.agency == "1")) return;


                        if (selectedStop && (selectedStop.stop_id === stop.stop_id)) {
                            const marker = L.marker([stop.lat, stop.lon], { icon: darkMode ? selectedStopIconDark : selectedStopIconLight, opacity: 0.7 });
                            marker.addTo(newSelectedStopLayer);
                        } else {
                            if (stops.length > 850) {
                                layers.current.stopLayer.clearLayers();
                                layers.current.selectedStopLayer.clearLayers();
                                return;
                            };

                            const marker = L.marker([stop.lat, stop.lon], { icon: darkMode ? stopIconDark : stopIconLight, opacity: 0.7 });

                            marker.on("click", e => {
                                L.DomEvent.stopPropagation(e);
                                setSelectedStop(stop);
                            });

                            marker.addTo(newStopLayer);
                        }
                    });

                    layers.current.stopLayer.clearLayers();
                    layers.current.selectedStopLayer.clearLayers();

                    layers.current.stopLayer.addLayer(newStopLayer);
                    layers.current.selectedStopLayer.addLayer(newSelectedStopLayer);
                })
                .catch(err => console.error("Stop load error:", err));
        };

        loadStops();

        map.on("moveend", loadStops);

        return () => {
            map.off("moveend", loadStops);
        };

    }, [renderStops, darkMode, selectedStop, setWarningText]);



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

                const bounds = map.getBounds();

                vehicles.forEach(v => {
                    if (!v.lat || !v.lon) return;
                    const latlng = L.latLng(v.lat, v.lon);

                    const marker = L.marker(latlng, {
                        icon: (v.type === 0) ? linkIcon : busIcon,
                        pane: 'vehiclePane',
                        opacity: 0.85,
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