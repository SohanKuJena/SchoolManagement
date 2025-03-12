require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');

const app = express();
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// MySQL Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err);
        process.exit(1);
    }
    console.log('Connected to MySQL Database');
});

app.use((req, res, next) => {
    console.log(`📡 Received ${req.method} request to ${req.url}`);
    next();
});

// Middleware to remove newline characters from the URL
app.use((req, res, next) => {
    req.url = req.url.replace(/%0D%0A/g, '');
    next();
});

app.get('/', (req, res) => {
    res.send('Server is running');
});

// Handle GET requests to /addSchool
app.get('/addSchool', (req, res) => {
    res.status(405).json({ error: 'Use POST method to add a school' });
});

// Add School API
app.post('/addSchool', (req, res) => {
    console.log("==> Inside POST /addSchool route"); // New debug log
    console.log("Request Method:", req.method, "URL:", req.originalUrl); // New debug info
    console.log("Received POST request to /addSchool");  // Log the request
    console.log("Raw URL:", req.originalUrl);  // Check if %0A appears
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    const { name, address, latitude, longitude } = req.body;

    if (!name || !address || !latitude || !longitude) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const query = 'INSERT INTO schools (name, address, latitude, longitude) VALUES (?, ?, ?, ?)';
    db.query(query, [name, address, latitude, longitude], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'School added successfully', id: result.insertId });
    });
});

// Function to calculate distance using Haversine formula
const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = angle => (Math.PI / 180) * angle;
    const R = 6371; // Earth's radius in km

    console.log(`Calculating distance between (${lat1}, ${lon1}) and (${lat2}, ${lon2})`);

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;
    console.log(`Calculated Distance: ${distance} km`);
    return distance;
};

// List Schools API (Sorted by Proximity)
app.get('/listSchools', (req, res) => {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    db.query('SELECT * FROM schools', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);

        const sortedSchools = results.map(school => {
            const distance = haversineDistance(userLat, userLon, school.latitude, school.longitude);
            console.log(`Distance to ${school.name}: ${distance} km`);
            return { ...school, distance };
        }).sort((a, b) => a.distance - b.distance);


        res.json(sortedSchools);
    });
});

// Catch-all route to help debug unhandled endpoints
app.use((req, res) => {
    console.error(`Unhandled request: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
