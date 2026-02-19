let map = L.map('map', {
    center: [47.6, -122.33],
    zoom: 13,
    preferCanvas: true,
    zoomControl: false,
    maxZoom: 18
});

map.createPane('vehiclePane');
map.getPane('vehiclePane').style.zIndex = 4000;

let routeLine;
let userLocation;
let routeLines = [];

const layers = {
    stopLayer: L.layerGroup().addTo(map),
    pinnedStopLayer: L.layerGroup().addTo(map),
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
            className: 'custom-cluster-icon',
            iconSize: [30, 30]
        })
    }).addTo(map)
}



const isMobile = window.matchMedia("(max-width: 768px)").matches;

let selectedStop;
let selectedStopMarker;
let selectedRoute;

let isDarkMode   = localStorage.getItem("theme") === "true";
let showOptions  = localStorage.getItem("showOptions") === "true";
let renderBusses = localStorage.getItem("busses") !== "false";
let renderStops  = localStorage.getItem("stops") !== "false";

let hoverTimeout;

const warn = document.getElementById("warning");
const button = document.getElementById("modeSwap");
const optionsButton = document.getElementById("settingsButton");
const vehiclesToggle = document.getElementById("toggleVehicles");
const stopsToggle = document.getElementById("toggleStops");
const splash = document.getElementById("splash");

const palette = [
    "#6FADCA", // kc metro
    "#2f4eb3", // soundtransit i think?
    "#2f4eb3", // kc water taxi
    "#2f4eb3", // vashon ferry
    "#f14377",  // streetcars
    "#f14377", // rapidride
];

const railColor = "#f14377";

const colorMap = {};
let paletteIndex = 0;

let defaultLine = {
    color: "#6FADCA",
    weight: 4,
    opacity: .4
}

let highlightedLine = {
    color: "#1a1a1a",
    weight: 4,
    opacity: 0.8
};

let dimmedLine = {
    color: "#6FADCA",
    weight: 4,
    opacity: 0.15
};

const hoverTooltip = L.tooltip({ sticky: true });


const stopSize = isMobile ? 32 : 24;
const selectedStopSize = isMobile ? 42 : 34;
const busSize = isMobile ? 28 : 20;

let stopIcon = L.icon({
    iconUrl: '/images/stop-icon.png',
    iconSize: [stopSize, stopSize],
    opacity: 0.8,
});

let selectedStopIcon = L.icon({
    iconUrl: '/images/selected-stop-icon.png',
    iconSize: [selectedStopSize, selectedStopSize],
    opacity: 0.8,
});


const busIcon = L.icon({
    iconUrl: "/images/bus.png",
    iconSize: [busSize, busSize],
});

const linkIcon = L.icon({
    iconUrl: "/images/rail.png",
    iconSize: [busSize + 4, busSize + 4],
});




document.addEventListener("click", function () {
    
    splash.classList.add("hidden");

    document.querySelectorAll('.ui').forEach(el => {
        el.classList.add('shown');
    });
});

function initMap() {
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
    }).addTo(map);

    isDarkMode ? darkMode() : lightMode();
    console.log(isDarkMode);
}

function switchMode() {
    map.eachLayer(function(layer) {
        if (layer instanceof L.TileLayer) {
            map.removeLayer(layer);
        }
    });

    if (isDarkMode) {
        isDarkMode = false;
        lightMode();
    } else {
        isDarkMode = true;
        darkMode();
    }
    
    selectedStop = null;
    selectedStopMarker = null;
    layers.pinnedStopLayer.clearLayers();

    clearHighlight();
    loadArrivals();
    updateStops();
}

function lightMode() {
    highlightedLine = {
        color: "#1a1a1a",
        weight: 6,
        opacity: 0.9
    };

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
    }).addTo(map);

    button.querySelector('img').src = "/images/moon.png";
    optionsButton.querySelector('img').src = "/images/gear-dark.png";

    stopIcon = L.icon({
        iconUrl: '/images/stop-icon.png',
        iconSize: [stopSize, stopSize],
    });
    selectedStopIcon = L.icon({
        iconUrl: '/images/selected-stop-icon.png',
        iconSize: [selectedStopSize, selectedStopSize],
    });

    document.querySelectorAll('.info').forEach(el => {
        el.classList.remove('dark');
    });

    document.querySelectorAll(".leaflet-container").forEach(e => {
        e.style.backgroundColor = "#b8bdbe";
    });

    localStorage.setItem("theme", "false");
}

function darkMode() {
    highlightedLine = {
        color: "#ffffff",
        weight: 6,
        opacity: 0.9
    };

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
    }).addTo(map);

    button.querySelector('img').src = "/images/sun.png";
    optionsButton.querySelector('img').src = "/images/gear.png";

    stopIcon = L.icon({
        iconUrl: '/images/stop-icon-dark.png',
        iconSize: [stopSize, stopSize],
    });
    selectedStopIcon = L.icon({
        iconUrl: '/images/selected-stop-icon-dark.png',
        iconSize: [selectedStopSize, selectedStopSize],
    });

    document.querySelectorAll('.info').forEach(el => {
        el.classList.add('dark');
    });
    
    document.querySelectorAll(".leaflet-container").forEach(e => {
        e.style.backgroundColor = "#151515";
    });

    localStorage.setItem("theme", "true");
}

function getMappedColor(original) {
    if (!original) return defaultLine.color;

    if (!colorMap[original]) {
        colorMap[original] = palette[paletteIndex % palette.length]
        paletteIndex++;
    }

    return colorMap[original];
}

async function loadArrivals() {

    const info = document.getElementById("data");
    const line = document.getElementById("solid");
    const list = document.getElementById("arrivals");
    const name = document.getElementById("stopName");
    const routesText = document.getElementById("routes");

    if (!selectedStop) {
        info.classList.add("hidden");
        return;
    }

    info.classList.remove("hidden");
    routesText.innerHTML = "Retriving data...";
    list.innerHTML = "";
    name.innerHTML = "";
    line.style.display = "none";
    

    const res = await fetch(`/api/arrivals?stop_id=${selectedStop.agency}_${selectedStop.stop_id}`);
    const data = await res.json();


    const { routes, stopName, arrivals, direction } = data;

    if (!direction) {
        name.innerHTML = `${stopName}`;
    } else {
        name.innerHTML = `${stopName} <span class="direction">(${direction} bound)</span>`;
    }


    if (!stopName) {
        name.innerHTML = "";
    }

    if (!arrivals || arrivals.length === 0) {
        const li = document.createElement("li");
        li.innerHTML = "This route does not provide real-time data :("
        list.appendChild(li);
        return;
    }

    line.style.display = "block";

    shortArrivals = arrivals.slice(0, 9);


    shortArrivals.forEach(a => {
        const li = document.createElement("li");

        const arrivalTime = a.predictedArrivalTime || a.scheduledArrivalTime;


        const minutes = Math.round((arrivalTime - Date.now()) / 60000);

        if (minutes < 0) {
            li.innerHTML = `<b>${a.routeShortName} arrived ${(minutes * -1)} minutes ago</b>`
        } else if (minutes > 0) {
            li.innerHTML = `<b>${a.routeShortName} arriving in ${minutes} minutes</b><br>${a.tripHeadsign}`
        } else {
            li.innerHTML = `<b>${a.routeShortName} arriving now</b><br>${a.tripHeadsign}.`
        }

        if (arrivalTime == a.scheduledArrivalTime) {
            li.innerHTML = `${li.innerHTML} <span class="scheduledArrival">(scheduled)</span>`
        } else {
            li.classList.add("confirmedArrival");
        }



        list.appendChild(li);
    });

    if (!routes[0].data.entry.shortName) {
        routesText.innerHTML = "";
        return;
    };
    const routesData = routes.map(item => item.data.entry.shortName);
    routesText.innerHTML = `Serving ${routesData.join(", ")}`;
}

function getWeightForZoom(zoom) {
    const minZoom = 10;
    const maxZoom = 18;

    const minWeight = 1.5;
    const maxWeight = 10;

    const scale = (zoom - minZoom) / (maxZoom - minZoom);
    return minWeight + scale * (maxWeight - minWeight);
}

function updateLineWeights() {
    const zoom = map.getZoom();
    const newWeight = getWeightForZoom(zoom);

    routeLines.forEach(line => {
        line.setStyle({
            weight: newWeight
        });
    });
}

map.on('zoomend', updateLineWeights);

async function updateLines() {
    
    const res = await fetch(
        `/api/routes-nearby`
    );
    const routes = await res.json();

    layers.routeLayer.clearLayers();
    routeLines = [];

    routes.forEach((routeShape, index) => {

        routeShape.shape.sort(
            (a, b) => a.shape_pt_sequence - b.shape_pt_sequence
        );
        
        const coords = routeShape.shape.map(point => [
            point.shape_pt_lat,
            point.shape_pt_lon,
        ]);

        let isRail = ((routeShape.route_type === 0) && routeShape.agency_id.startsWith("st_"));
        let color = isRail ? railColor : getMappedColor(routeShape.route_color);

        const line = L.polyline(coords, {
            ...defaultLine,
            color: color,
            opacity: isRail ? (defaultLine.opacity * 2) : defaultLine.opacity
        }).addTo(map);

        line.routeName = routeShape.name ?? "Unnamed Route"; 
        line.latLngs = line.getLatLngs();
        line.routeId = routeShape.route_id;
        line.color = color;
        line.isRail = isRail;

        layers.routeLayer.addLayer(line);
        routeLines.push(line);
    });   
}

async function updateStops() {
    if (!renderStops) {
        layers.stopLayer.clearLayers();
        warn.style.display = "none";
        return;
    }

    const bounds = map.getBounds();

    const res = await fetch(
        `/api/stops-nearby?bbox=${bounds.toBBoxString()}`
    );
    const stops = await res.json();

    const newLayer = L.layerGroup();

    if (stops.length > 750) {
        warn.style.display = "block";
        warn.querySelector("h3").textContent = "Zoom in to view stops!";
        layers.stopLayer.clearLayers();
        return;
    };
    warn.style.display = "none";
    
    stops.forEach((stop) => {
        if (selectedStop && (selectedStop.stop_id === stop.stop_id)) return;

        if ((stop.stop_id.includes("LS") || stop.stop_id.includes("C") || stop.name.toLowerCase().includes("entrance") || stop.name.toLowerCase().includes("bay"))  && !(stop.agency == "1")) return;

        if ((stop.stop_id.length === 3 || stop.stop_id.length === 4) && !(stop.agency == "1")) return;
        if ((stop.name.includes("&")) && !(stop.agency == "1")) return;

        // if (stop.agency == "1") return;

        const coords = [stop.lat, stop.lon];
        const marker = L.marker(coords, { icon: stopIcon, opacity: 0.75 }).addTo(map)
        
        marker.stopData = stop;
        newLayer.addLayer(marker);


        marker.on('click', (e) => {
            // console.log(marker.stopData.name, marker.stopData.stop_id);
            L.DomEvent.stopPropagation(e);

            layers.pinnedStopLayer.clearLayers();

            selectedStopMarker = L.marker(coords, {
                icon: selectedStopIcon,
                opacity: 1
            }).addTo(layers.pinnedStopLayer);

            selectedStop = stop;

            loadArrivals();
            updateStops();
        });
    });
    layers.stopLayer.clearLayers();
    layers.stopLayer.addLayer(newLayer);
}

async function updateVehicles() {
    if (!renderBusses) {
        layers.busLayer.clearLayers();
    };

    const res = await fetch(`/api/vehicles`);
    const vehicles = await res.json();

    const newBusLayer = L.layerGroup();
    const newRailLayer = L.layerGroup();
    const bounds = map.getBounds(); 

    vehicles.forEach(v => {
        if (!v.lat || !v.lon) return;

        const latlng = L.latLng(v.lat, v.lon);
        if (!bounds.contains(latlng)) return;

        
        const marker = L.marker(latlng, { 
            icon: (v.type === 0) ? linkIcon : busIcon,
            pane: 'vehiclePane',
            interactive: false
        });

        if (v.type === 0) {
            newRailLayer.addLayer(marker)
        } else {
            newBusLayer.addLayer(marker);
        }
    });

    layers.busLayer.clearLayers();
    layers.railLayer.clearLayers();

    layers.railLayer.addLayer(newRailLayer);

    if (renderBusses) {
        layers.busLayer.addLayer(newBusLayer);
    };
}


window.onload = () => {
    initMap();

    initToggle();
    updateStops();
    updateVehicles();

    updateLines();
    updateLineWeights();

    button.addEventListener("click", switchMode);
    optionsManager();

    setInterval(loadArrivals, 30000);
    setInterval(updateVehicles, 15000);
};

const selectRoute = document.getElementById("searchRoutes");
const routeInput = document.getElementById("routeInput");

function getInput() {
    const input = routeInput.value;

    if (!input) {
        clearHighlight();
    } else {
        result = highlightRouteByName(input);
        if (result.length > 0) {
            routeInput.value = "";
            selectRoute.classList.add("okay");
        }
    }

    if (result.length == 0) {
        clearHighlight();
    }
}

selectRoute.addEventListener("click", () => {
    getInput();
});

routeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        getInput();
    }
});

routeInput.addEventListener("input", () => {
    if (routeInput.value.trim().length === 0) {
        selectRoute.classList.remove("okay");
    } else {
        selectRoute.classList.add("okay");
    }
});



function initToggle() {    
    vehiclesToggle.addEventListener("change", function () {
        if (this.checked) {
            renderBusses = true;
            localStorage.setItem("busses", "true");
        } else {
            renderBusses = false;
            localStorage.setItem("busses", "false");
        }
        updateVehicles();
    });

    stopsToggle.addEventListener("change", function () {
        if (this.checked) {
            renderStops = true;
            localStorage.setItem("stops", "true");
        } else {
            renderStops = false;
            localStorage.setItem("stops", "false");
        }
        updateStops();
    });

    vehiclesToggle.checked = renderBusses;
    stopsToggle.checked = renderStops;
}


function optionsManager() {
    if (!showOptions) {
        options.classList.add("hidden");
    }

    optionsButton.addEventListener("click", () => {
        if (showOptions) {
            options.classList.add("hidden");
            localStorage.setItem("showOptions", "false");
            showOptions = false;
        } else {
            options.classList.remove("hidden");
            localStorage.setItem("showOptions", "true");
            showOptions = true;
        }
    });
}

map.on("moveend", () => {
    updateStops();
    updateVehicles();
});

function isNearLine(map, latlng, polyline, tolerance = 8) {
    const point = map.latLngToLayerPoint(latlng);

    for (let i = 0; i < polyline.latLngs.length - 1; i++) {
        const p1 = map.latLngToLayerPoint(polyline.latLngs[i]);
        const p2 = map.latLngToLayerPoint(polyline.latLngs[i + 1]);

        if (L.LineUtil.pointToSegmentDistance(point, p1, p2) <= tolerance)
            return true;
    }

    return false;
}

function highlightRouteByName(routeName) {
    let lines = [];

    routeLines.forEach(line => {
        if (line.routeName.toLowerCase() === routeName.toLowerCase()) {
            line.setStyle(highlightedLine);
            lines.push(line);
            selectedRoute = line;
        } else {
            line.setStyle({...dimmedLine, color: line.color});
        }
    });

    if (lines.length > 0) {
        const group = L.featureGroup(lines);
        map.flyToBounds(group.getBounds(), { padding: [50, 50] });
    }

    return lines;
}

function clearHighlight(){
    routeLines.forEach(line => {
        line.setStyle({...defaultLine, color: line.color, opacity: line.isRail ? (defaultLine.opacity * 2) : defaultLine.opacity});
        updateLineWeights();
    });
}

function isLineVisible(line, bounds) {
    return line.latLngs.some(ll => bounds.contains(ll));
}

map.on('mousemove', e => {
    hoverTooltip.setLatLng(e.latlng)
    if (hoverTimeout) return; 

    hoverTimeout = setTimeout(() => {
        hoverTimeout = null;
        const bounds = map.getBounds();

        const hits = routeLines
            .filter(line => isLineVisible(line, bounds))
            .filter(line => isNearLine(map, e.latlng, line));

        if (hits.length) {
            hoverTooltip
                .setContent(hits.map(l => l.routeName).join(', '))
                .addTo(map);
        } else {
            map.removeLayer(hoverTooltip);
        }
    }, 100); 
});

map.on('click', (e) => {
    clearHighlight();

    if (selectedStopMarker) {
        selectedStopMarker.setIcon(stopIcon);
        selectedStopMarker = null;
    }
    selectedStop = null;

    layers.pinnedStopLayer.clearLayers();

    const info = document.getElementById("data");
    info.classList.add("hidden");
    updateStops();
});

