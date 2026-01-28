let map;
let routeLine;
let userLocation;
let routeLines = [];
let selectedRouteLine;

let defaultLine = {
    color: "#ff0000",
    weight: 3,
    opacity: 0.3
}

let selectedLine = {
    color: "#0008ff",
    weight: 5,
    opacity: 0.8
}

function initMap() {
    map = L.map('map').setView([47.6, -122.33], 11);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
    }).addTo(map);

    map.on("click", () => {
        if (selectedRouteLine) {
            selectedRouteLine.setStyle(defaultLine);
            selectedRouteLine = null;
        }
    });

    navigator.geolocation.getCurrentPosition(async (pos) => {
        userLocation = pos.coords;
        updateMap();
        console.log(userLocation);

        map.setView([userLocation.latitude, userLocation.longitude], 13);
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


async function updateMap() {
    

    const res = await fetch(
        `/api/routes-nearby?lat=${userLocation.latitude}&lon=${userLocation.longitude}`
    );

    const routes = await res.json();

    routes.forEach(r => {
        const coords = polyline.decode(r.shape.data.entry.points);

        const line = L.polyline(coords, defaultLine)
        .bindPopup(`${r.name}`)
        .bindTooltip(`${r.name}`, { sticky: true })
        .addTo(map);

        line.on("click", async (e) => {
            e.originalEvent.stopPropagation();
            highlightRoute(line);
        });

        routeLines.push(line);
    });   
}

window.onload = () => {
    initMap();
    loadArrivals();

    setInterval(loadArrivals, 30000);
};