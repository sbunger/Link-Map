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

const db = await openDb(config);

dotenv.config();

const app = express();
const PORT = 3000;

const KEY = process.env.OBA_API_KEY;
if (!KEY) {
    console.error("No API key!");
    process.exit(1);
}

const client = new OnebusawaySDK({
    apiKey: KEY,
});

app.use(express.static("public"));
app.head("/", (req, res) => res.status(200).end());

app.get("/api/arrivals", async (req, res) => {
    try {
        const stopId = req.query.stop_id;
                
        const stop = await client.stop.retrieve(stopId);
        const arrivalsList = await client.arrivalAndDeparture.list(stopId, 
            {
                minutesBefore: 0,
                minutesAfter: 60
            }
        );

        const stopName = stop.data.entry.name;
        const arrivals = arrivalsList.data.entry.arrivalsAndDepartures;
        const direction = stop.data.entry.direction;
        
        const routes = await Promise.all(stop.data.entry.routeIds.map(route => client.route.retrieve(route))
);

        res.json({ routes, stopName, arrivals, direction });
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

app.get("/api/stops-nearby", async (req, res) => {
    try {
        const bbox = req.query.bbox;

        const [west, south, east, north] = bbox.split(",").map(Number);

        const rows = db.prepare(`
            SELECT
                stop_id,
                stop_name,
                stop_lat,
                stop_lon
            FROM stops
            WHERE stop_lat BETWEEN ? AND ?
                AND stop_lon BETWEEN ? AND ?
        `).all(south, north, west, east);

        res.json(
            rows.map(stop => ({
                stop_id: stop.stop_id,
                name: stop.stop_name,
                lat: stop.stop_lat,
                lon: stop.stop_lon,
            }))
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load nearby stops" });
    }
});

app.listen(PORT, () => {
    console.log("Server Online")
});