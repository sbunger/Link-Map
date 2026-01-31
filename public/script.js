let map = L.map('map', {
    center: [47.6, -122.33],
    zoom: 13,
    preferCanvas: true
});

let routeLine;
let userLocation;
let routeLines = [];
let selectedRouteLine;
let stopLayer = L.layerGroup().addTo(map);

const warn = document.getElementById("warning")

let defaultLine = {
    color: "#ff0000",
    weight: 4,
    opacity: 0.3
}

let selectedLine = {
    color: "#0008ff",
    weight: 5.5,
    opacity: 0.8
}


function initMap() {
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
    }).addTo(map);

    map.on("click", () => {
        if (selectedRouteLine) {
            selectedRouteLine.setStyle(defaultLine);
            selectedRouteLine = null;
        }
    });
}

async function loadArrivals() {
    const res = await fetch("/api/arrivals");
    const data = await res.json();

    const { stopName, arrivals, shape } = data;

    document.getElementById("stopName").textContent = `Stop: ${stopName}`;

    const list = document.getElementById("arrivals");
    list.innerHTML = "";

    arrivals.forEach(a => {
        const li = document.createElement("li");

        const arrivalTime = a.predictedArrivalTime || a.scheduledArrivalTime;

        const minutes = Math.round((arrivalTime - Date.now()) / 60000)

        if (minutes < 0) {
            li.textContent = `${a.routeShortName} arrived ${(minutes * -1)} minutes ago.`
        } else if (minutes > 0) {
            li.textContent = `${a.routeShortName} arriving in ${minutes} minutes.`
        } else {
            li.textContent = `${a.routeShortName} arriving now.`
        }


        list.appendChild(li);
    });
}

function highlightRoute(line) {
    routeLines.forEach(l => {
        l.setStyle(defaultLine);
    });

    line.setStyle(selectedLine);

    line.bringToFront();
    selectedRouteLine = line;
}


async function updateLines() {
    
    const res = await fetch(
        `/api/routes-nearby`
    );

    const routes = await res.json();

    routeLines.forEach(line => map.removeLayer(line));
    routeLines = [];

    routes.forEach((routeShape) => {

        routeShape.shape.sort(
            (a, b) => a.shape_pt_sequence - b.shape_pt_sequence
        );
        
        let coords = routeShape.shape.map(point => [
            point.shape_pt_lat,
            point.shape_pt_lon,
        ]);

        const line = L.polyline(coords, defaultLine)
            .bindPopup(`${routeShape.name ? routeShape.name : "Unnamed Route"}`)
            .bindTooltip(`${routeShape.name ? routeShape.name : "Unnamed Route"}`, { sticky: true })
            .addTo(map);

        line.on("click", async (e) => {
            e.originalEvent.stopPropagation();
            highlightRoute(line);
        });

        routeLines.push(line);
    });   
}


async function updateStops() {

    const bounds = map.getBounds();

    const res = await fetch(
        `/api/stops-nearby?bbox=${bounds.toBBoxString()}`
    );

    stopLayer.clearLayers();

    const stops = await res.json();

    if (stops.length > 300) {
        warn.style.display = "block";
        return;
    };

    warn.style.display = "none";
    
    stops.forEach((stop) => {
        const coords = [stop.lat, stop.lon];
        const marker = L.marker(coords).addTo(map)
            .bindTooltip(stop.name);

        stopLayer.addLayer(marker);
    });
}


window.onload = () => {
    initMap();
    loadArrivals();
    updateStops();

    updateLines();

    setInterval(loadArrivals, 30000);
};

map.on("moveend", updateStops);