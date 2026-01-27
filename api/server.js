import express from "express";
import OnebusawaySDK from 'onebusaway-sdk';
import dotenv from "dotenv";
dotenv.config();

const app = express();

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

export default app;