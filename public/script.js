async function loadArrivals() {
    const res = await fetch("/api/arrivals");
    const data = await res.json();

    const { stopName, arrivals } = data;

    document.getElementById("stopName").textContent = `Stop: ${stopName}`;

    const list = document.getElementById("arrivals");
    list.innerHTML = "";

    arrivals.forEach(a => {
        const li = document.createElement("li");

        const minutes = Math.round((a.predictedArrivalTime - Date.now()) / 60000)

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

loadArrivals();
setInterval(loadArrivals, 30000);