import express from "express";
import fetch from "node-fetch";

import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = 3000;

const KEY = process.env.OBA_API_KEY;

const STOP_ID_TEST = "40_1121";

if (!KEY) {
    console.error("No API key!");
    process.exit(1);
}

app.use(express.static("public"));

app.get("/api/arrivals", async (req, res) => {
    try {
        const arrivalsURL = `https://api.pugetsound.onebusaway.org/api/where/arrivals-and-departures-for-stop/${STOP_ID_TEST}.json?key=${KEY}`;
        const arrivalsResponse = await fetch(arrivalsURL);
        const arrivalsData = await arrivalsResponse.json();
        const arrivals = arrivalsData.data.entry.arrivalsAndDepartures;

        const stopURL = `https://api.pugetsound.onebusaway.org/api/where/stop/${STOP_ID_TEST}.json?key=${KEY}`;
        const stopsResponse = await fetch(stopURL);
        const stopsData = await stopsResponse.json();
        // console.log(stopsData);
        const stopName = stopsData.data.entry.name;

        res.json({ stopName, arrivals });
    } catch (err) {
        console.error("API fetch failed:", err);
        res.status(500).json({ error: "Failed to fetch arrivals" });
    }
});

app.listen(PORT, () => {
    console.log("Server Online")
});