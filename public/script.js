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

let hoverTimeout;

const warn = document.getElementById("warning")

let defaultLine = {
    color: "#6FADCA",
    weight: 4,
    opacity: .333
}

const hoverTooltip = L.tooltip({ sticky: true });

const stopIcon = L.icon({
    iconUrl: '/images/stop-icon.png',
    iconSize: [30, 30],
});

const selectedStopIcon = L.icon({
    iconUrl: '/images/selected-stop-icon.png',
    iconSize: [40, 40],
});


function initMap() {
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
    }).addTo(map);
}

async function loadArrivals() {

    const info = document.getElementById("data");
    const list = document.getElementById("arrivals");
    const name = document.getElementById("stopName");
    const routesText = document.getElementById("routes");

    if (!selectedStop) {
        info.style.display = "none";
        return;
    }

    info.style.display = "block";
    routesText.textContent = "Retriving data...";
    list.innerHTML = "";
    name.innerHTML = "";
    

    const res = await fetch(`/api/arrivals?stop_id=1_${selectedStop}`);
    const data = await res.json();


    const { routes, stopName, arrivals, direction } = data;
    console.log(routes);

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
        li.textContent = "This route does not provide real-time data :("
        list.appendChild(li);
        return;
    }

    shortArrivals = arrivals.slice(0, 9);


    shortArrivals.forEach(a => {
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

        if (arrivalTime == a.scheduledArrivalTime) {
            li.innerHTML = `${li.textContent} <span class="scheduledArrival">(scheduled)</span>`
        } else {
            li.classList.add("confirmedArrival");
        }



        list.appendChild(li);
    });

    if (!routes[0].data.entry.shortName) return;
    const routesData = routes.map(item => item.data.entry.shortName);
    routesText.textContent = `Serving ${routesData.join(", ")}`;
}



async function updateLines() {
    
    const res = await fetch(
        `/api/routes-nearby`
    );

    const routes = await res.json();

    routeLines.forEach(line => map.removeLayer(line));
    routeLines = [];

    routes.forEach((routeShape, index) => {

        routeShape.shape.sort(
            (a, b) => a.shape_pt_sequence - b.shape_pt_sequence
        );
        
        let coords = routeShape.shape.map(point => [
            point.shape_pt_lat,
            point.shape_pt_lon,
        ]);

        const line = L.polyline(coords, defaultLine)
            .addTo(map);

        line.routeName = routeShape.name ?? "Unnamed Route"; 
        line.latLngs = line.getLatLngs();

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

    if (stops.length > 750) {
        warn.style.display = "block";
        return;
    };

    warn.style.display = "none";
    
    stops.forEach((stop) => {
        const coords = [stop.lat, stop.lon];
        const marker = L.marker(coords, { icon: stopIcon }).addTo(map)
        
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
        selectedStopMarker.setIcon(stopIcon); // reset previous marker icon
        selectedStopMarker = null;
    }
    selectedStop = null;

    // Hide the arrivals info panel
    const info = document.getElementById("data");
    info.style.display = "none";
});