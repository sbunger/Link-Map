let map = L.map('map', {
    center: [47.6, -122.33],
    zoom: 13,
    preferCanvas: true,
    zoomControl: false,
    maxZoom: 18
});

map.createPane('vehiclePane');
map.getPane('vehiclePane').style.zIndex = 7000

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
    maxClusterRadius: 40,
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
let showOptions = localStorage.getItem("showOptions") !== "false";

let defaultLine = {
    color: "#6FADCA",
    weight: 4,
    opacity: .333
}

const hoverTooltip = L.tooltip({ sticky: true });

let stopIcon = L.icon({
    iconUrl: '/images/stop-icon.png',
    iconSize: [24, 24],
});

let selectedStopIcon = L.icon({
    iconUrl: '/images/selected-stop-icon.png',
    iconSize: [34, 34],
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

    loadArrivals();
    updateStops();
}

function lightMode() {
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

        const line = L.polyline(coords, defaultLine)
            .addTo(map);

        line.routeName = routeShape.name ?? "Unnamed Route"; 
        line.latLngs = line.getLatLngs();
        line.routeId = routeShape.route_id;

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

    if (stops.length > 900) {
        warn.style.display = "block";
        warn.querySelector("h3").textContent = "Zoom in to view stops!";
        stopLayer.clearLayers();
        return;
    };
    warn.style.display = "none";
    
    stops.forEach((stop) => {
        if (selectedStop === stop.stop_id) return;

        const coords = [stop.lat, stop.lon];
        const marker = L.marker(coords, { icon: stopIcon }).addTo(map)
        
        marker.stopData = stop;
        newLayer.addLayer(marker);


        marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);

            pinnedStopLayer.clearLayers();

            selectedStopMarker = L.marker(coords, {
                icon: selectedStopIcon
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

    button.addEventListener("click", switchMode);
    optionsManager();

    setInterval(loadArrivals, 30000);
    setInterval(updateVehicles, 15000);
};

vehiclesToggle.addEventListener("change", function () {
  if (this.checked) {
    renderBusses = true;
  } else {
    renderBusses = false;
  }
  updateVehicles();
});

stopsToggle.addEventListener("change", function () {
  if (this.checked) {
    renderStops = true;
  } else {
    renderStops = false;
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

