let map;
let routeLine;

function initMap() {
    map = L.map('map').setView([47.6, -122.33], 11);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"', {
        attribution: '&copy; CARTO'
    }).addTo(map);
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

    //console.log(shape.data.entry);
    const coordinates = polyline.decode(shape.data.entry.points);

    routeLine = L.polyline(coordinates, {
        color: 'red',
        weight: 4,
        opacity: 0.8
    }).addTo(map);

    //map.fitBounds(routeLine.getBounds());
}

window.onload = () => {
    initMap();
    loadArrivals();

    setInterval(loadArrivals, 30000);
};