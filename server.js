import express from "express";
import OnebusawaySDK from 'onebusaway-sdk';
import dotenv from "dotenv";

import { importGtfs, openDb, getRoutes, getShapes, getTrips } from "gtfs";

const config = {
    sqlitePath: "data/gtfs/gtfs.sqlite",
    agencies: [
        {
            agency_key: "local_agency",
            path:"data/gtfs/",
        },
    ],
};

await importGtfs(config);

await openDb(config);


dotenv.config();

const app = express();
const PORT = 3000;

const STOP_ID = "40_1121";
const ROUTE_ID = "40_100479"

const KEY = process.env.OBA_API_KEY;
if (!KEY) {
    console.error("No API key!");
    process.exit(1);
}

const client = new OnebusawaySDK({
    apiKey: KEY,
});

app.use(express.static("public"));

app.get("/api/arrivals", async (req, res) => {
    try {
        const route = await client.tripsForRoute.list(ROUTE_ID);
                
        const stop = await client.stop.retrieve(STOP_ID);
        const arrivalsList = await client.arrivalAndDeparture.list(STOP_ID, 
            {
                minutesBefore: 10,
                minutesAfter: 60,
                maxArrivals: 10
            }
        );

        const stopName = stop.data.entry.name;
        const arrivals = arrivalsList.data.entry.arrivalsAndDepartures;

        res.json({ stopName, arrivals });
    } catch (err) {
        console.error("API fetch failed:", err);
        res.status(500).json({ error: "Failed to fetch arrivals" });
    }
});

app.get("/api/routes-nearby", async (req, res) => {
    try {
        const routes = await getRoutes();
        const shapes = [];

        for (const route of routes) {
            const trips = await getTrips({ route_id: route.route_id })

            const shapeCounts = {};
            for (const trip of trips) {
                if (!trip.shape_id) continue;
                shapeCounts[trip.shape_id] =
                    (shapeCounts[trip.shape_id] || 0) + 1;
            }

            const bestShapeId = Object.entries(shapeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];


            const shape = await getShapes({
                shape_id: bestShapeId,
            });

            shapes.push({
                shape: shape,
                name: route.route_short_name,
                route_id: route.route_id,
                route_color: route.route_color,
            });
        }

        res.json(shapes);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load nearby routes" });
    }
    
});

app.get("api/nearby-stops", async (req, res) => {
    try {
        const { lat, lon } = req.query;

        const results = await client.stopsForLocation.list({
            lat,
            lon,
            radius: 2500
        });

        
        
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load nearby stops" });
    }
});

app.listen(PORT, () => {
    console.log("Server Online")
});