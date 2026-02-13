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

let stopLayer = L.layerGroup().addTo(map);
let pinnedStopLayer = L.layerGroup().addTo(map);
let routeLayer = L.layerGroup().addTo(map);

let vehicleLayer = L.markerClusterGroup({
    spiderfyOnMaxZoom: false,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    maxClusterRadius: 80,
    pane: 'vehiclePane',
    iconCreateFunction: function(cluster) {
        const count = cluster.getChildCount();
        return L.divIcon({
            html: `<div class="cluster-count">${count}</div>`,
            className: 'custom-cluster-icon',
            iconSize: [30, 30]
        });
    }
});


map.addLayer(vehicleLayer);

let selectedStop;
let selectedStopMarker;
let selectedRoute;

let isDarkMode = false;
let renderBusses = true;
let renderStops = true;

let hoverTimeout;

const warn = document.getElementById("warning");
const button = document.getElementById("modeSwap");

const optionsButton = document.getElementById("settingsButton");


const vehiclesToggle = document.getElementById("toggleVehicles");
const stopsToggle = document.getElementById("toggleStops");

const savedTheme = localStorage.getItem("theme");
let showOptions = localStorage.getItem("showOptions") === "true";
const savedRenderBusses = localStorage.getItem("busses");
const savedRenderStops = localStorage.getItem("stops");

const palette = [
    "#6FADCA", // kc metro
    "#2f4eb3", // soundtransit i think?
    "#2f4eb3", // kc water taxi
    "#2f4eb3", // vashon ferry
    "#f14377",  // streetcars
    "#f14377", // rapidride
];

const colorMap = {};
let paletteIndex = 0;

let defaultLine = {
    color: "#6FADCA",
    weight: 4,
    opacity: .45
}

let highlightedLine = {
    color: "#1a1a1a",
    weight: 4,
    opacity: 0.9
};

let dimmedLine = {
    color: "#6FADCA",
    weight: 4,
    opacity: 0.15
};

const hoverTooltip = L.tooltip({ sticky: true });

let stopIcon = L.icon({
    iconUrl: '/images/stop-icon.png',
    iconSize: [24, 24],
    opacity: 0.7,
});

let selectedStopIcon = L.icon({
    iconUrl: '/images/selected-stop-icon.png',
    iconSize: [34, 34],
    opacity: 0.7,
});

const busIcon = L.icon({
    iconUrl: "/images/bus.png",
    iconSize: [20, 20],
});



function initMap() {
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
    }).addTo(map);

    if (savedTheme === "dark") {
        darkMode();
        isDarkMode = true;
    }

    if (savedRenderBusses === "false") {
        renderBusses = false;
        vehiclesToggle.checked = false;
    }

    if (savedRenderStops === "false") {
        renderStops = false;
        stopsToggle.checked = false;
    }
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
    pinnedStopLayer.clearLayers();

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
        iconSize: [24, 24],
    });
    selectedStopIcon = L.icon({
        iconUrl: '/images/selected-stop-icon.png',
        iconSize: [34, 34],
    });

    document.querySelectorAll('.info').forEach(el => {
        el.classList.remove('dark');
    });

    document.querySelectorAll(".leaflet-container").forEach(e => {
        e.style.backgroundColor = "#b8bdbe";
    });

    localStorage.setItem("theme", "light");
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
        iconSize: [24, 24],
    });
    selectedStopIcon = L.icon({
        iconUrl: '/images/selected-stop-icon-dark.png',
        iconSize: [34, 34],
    });

    document.querySelectorAll('.info').forEach(el => {
        el.classList.add('dark');
    });
    
    document.querySelectorAll(".leaflet-container").forEach(e => {
        e.style.backgroundColor = "#151515";
    });

    localStorage.setItem("theme", "dark");
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
        info.style.display = "none";
        return;
    }

    info.style.display = "block";
    routesText.innerHTML = "Retriving data...";
    list.innerHTML = "";
    name.innerHTML = "";
    line.style.display = "none";
    

    const res = await fetch(`/api/arrivals?stop_id=1_${selectedStop}`);
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
        console.log(a.tripHeadsign);

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

    routeLayer.clearLayers();
    routeLines = [];

    routes.forEach((routeShape, index) => {

        routeShape.shape.sort(
            (a, b) => a.shape_pt_sequence - b.shape_pt_sequence
        );
        
        const coords = routeShape.shape.map(point => [
            point.shape_pt_lat,
            point.shape_pt_lon,
        ]);

        const original = routeShape.route_color;

        const color = getMappedColor(routeShape.route_color);

        const line = L.polyline(coords, {
            ...defaultLine,
            color: color,
        })
            .addTo(map);

        line.routeName = routeShape.name ?? "Unnamed Route"; 
        line.latLngs = line.getLatLngs();
        line.routeId = routeShape.route_id;
        line.color = color;

        routeLayer.addLayer(line);
        routeLines.push(line);
    });   
}

async function updateStops() {
    if (!renderStops) {
        stopLayer.clearLayers();
        warn.style.display = "none";
        return;
    }

    const bounds = map.getBounds();

    const res = await fetch(
        `/api/stops-nearby?bbox=${bounds.toBBoxString()}`
    );
    const stops = await res.json();

    const newLayer = L.layerGroup();

    if (stops.length > 700) {
        warn.style.display = "block";
        warn.querySelector("h3").textContent = "Zoom in to view stops!";
        stopLayer.clearLayers();
        return;
    };
    warn.style.display = "none";
    
    stops.forEach((stop) => {
        if (selectedStop === stop.stop_id) return;

        const coords = [stop.lat, stop.lon];
        const marker = L.marker(coords, { icon: stopIcon, opacity: 0.75 }).addTo(map)
        
        marker.stopData = stop;
        newLayer.addLayer(marker);


        marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);

            pinnedStopLayer.clearLayers();

            selectedStopMarker = L.marker(coords, {
                icon: selectedStopIcon,
                opacity: 1
            }).addTo(pinnedStopLayer);

            selectedStop = stop.stop_id;

            loadArrivals();
            updateStops();
        });
    });
    stopLayer.clearLayers();
    stopLayer.addLayer(newLayer);
}

async function updateVehicles() {
    if (!renderBusses) {
        vehicleLayer.clearLayers();
        return;
    };

    const res = await fetch(`/api/vehicles`);
    const vehicles = await res.json();

    const newLayer = L.layerGroup();
    const bounds = map.getBounds(); 

    vehicles.forEach(v => {
        if (!v.lat || !v.lon) return;

        const latlng = L.latLng(v.lat, v.lon);

        if (bounds.contains(latlng)) {
            const marker = L.marker(latlng, { 
                icon: busIcon,
                pane: 'vehiclePane',
                opacity: 0.75,
                interactive: false
            });
            newLayer.addLayer(marker);
        }
    });

    vehicleLayer.clearLayers();
    vehicleLayer.addLayer(newLayer);
}


window.onload = () => {
    initMap();
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

selectRoute.addEventListener("click", () => {
    const input = routeInput.value;

    if (!input) {
        clearHighlight();
    } else {
        result = highlightRouteByName(input);
        if (result.length > 0) routeInput.value = "";
    }

    if (result.length == 0) {
        clearHighlight();
    }
});

routeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        const input = routeInput.value;

        if (!input) {
            clearHighlight();
        } else {
            result = highlightRouteByName(input);
            if (result.length > 0) routeInput.value = "";
        }

        if (result.length == 0) {
            clearHighlight();
        }
    }
})


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

function optionsManager() {
    if (showOptions) {
        options.style.display = "flex";
    }

    optionsButton.addEventListener("click", () => {
        if (showOptions) {
            options.style.display = "none";
            localStorage.setItem("showOptions", "false");
            showOptions = false;
        } else {
            options.style.display = "flex";
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
        if (line.routeName === routeName) {
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
        line.setStyle({...defaultLine, color: line.color});
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

    pinnedStopLayer.clearLayers();

    const info = document.getElementById("data");
    info.style.display = "none";
    updateStops();
});

