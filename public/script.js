let map = L.map('map', {
    center: [47.6, -122.33],
    zoom: 13,
    preferCanvas: true
});

let routeLine;
let userLocation;
let routeLines = [];
let stopLayer = L.layerGroup().addTo(map);

let selectedStop;
let selectedRouteLine;
let selectedStopMarker;

const warn = document.getElementById("warning")

let defaultLine = {
    color: "#6589ff",
    weight: 4,
    opacity: .35
}

const stopIcon = L.icon({
    iconUrl: '/images/stop-icon.png',
    iconSize: [20, 20],
});

const selectedStopIcon = L.icon({
    iconUrl: '/images/selected-stop-icon.png',
    iconSize: [25, 25],
});


function initMap() {
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
    }).addTo(map);
}

async function loadArrivals() {
    const info = document.getElementById("data");

    if (!selectedStop) {
        info.style.display = "none";
        return;
    }

    info.style.display = "block";

    const res = await fetch(`/api/arrivals?stop_id=1_${selectedStop}`);
    const data = await res.json();

    const { stopName, arrivals, direction } = data;

    document.getElementById("stopName").innerHTML = `${stopName} <span class="direction">(${direction} bound)</span>`;

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

    if (stops.length > 400) {
        warn.style.display = "block";
        return;
    };

    warn.style.display = "none";
    
    stops.forEach((stop) => {
        const coords = [stop.lat, stop.lon];
        const marker = L.marker(coords, { icon: stopIcon }).addTo(map)
            .bindTooltip(stop.name);
        
        if (selectedStop === stop.stop_id) {
            marker.setIcon(selectedStopIcon);
            selectedStopMarker = marker;
        }
        
        marker.stopData = stop;

        stopLayer.addLayer(marker);

        marker.on('click', () => {
            if (selectedStopMarker) {
                selectedStopMarker.setIcon(stopIcon);
            }

            marker.setIcon(selectedStopIcon);
            selectedStopMarker = marker;
            selectedStop = stop.stop_id;

            loadArrivals();
        });
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