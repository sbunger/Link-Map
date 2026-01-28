import express from "express";
import OnebusawaySDK from 'onebusaway-sdk';
import dotenv from "dotenv";
import { FetchError } from "node-fetch";
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
        const trip = route.data.references.trips[0];
                
        const shapeId = trip.shapeId;
        const shape = await client.shape.retrieve(shapeId);
        //console.log(shape);

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
        //console.log(arrivals);

        res.json({ stopName, arrivals, shape });
    } catch (err) {
        console.error("API fetch failed:", err);
        res.status(500).json({ error: "Failed to fetch arrivals" });
    }
});

app.get("/api/routes-nearby", async (req, res) => {
    try {
        const { lat, lon } = req.query;

        const results = await client.routesForLocation.list({
            lat,
            lon,
            radius: 2500
        });

        const routes = results.data.list;

        const shapes = [];

        for (const route of routes) {
            const trips = await client.tripsForRoute.list(route.id);
            const trip = trips.data.references.trips[0];
            if (!trip) continue;

            const shape = await client.shape.retrieve(trip.shapeId);

            shapes.push({
                routeId: route.id,
                name: route.shortName,
                shape: shape
            })
        }

        res.json(shapes);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load nearby routes" });
    }
    
});

app.listen(PORT, () => {
    console.log("Server Online")
});