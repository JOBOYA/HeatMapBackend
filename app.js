const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

require('dotenv').config();
let { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, ENDPOINT_ID } = process.env;
const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
    origin: 'http://localhost:5173'
}));
app.use(express.json());

const sql = new Pool({
    host: PGHOST,
    database: PGDATABASE,
    username: PGUSER,
    password: PGPASSWORD,
    port: 5432,
    ssl: 'require',
    connection: {
      options: `project=${ENDPOINT_ID}`,
    },
  });


  app.delete('/events/:id', async (req, res) => {
    const { id } = req.params;
  
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Missing or invalid property: id' });
    }
  
    try {
      const result = await sql`
        DELETE FROM savedate WHERE id = ${parseInt(id, 10)} RETURNING *;
      `;
  
      if (result.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }
  
      res.json(result[0]);
    } catch (error) {
      console.error('Error deleting event:', error);
      res.status(500).json({ error: 'Failed to delete event', details: error.message });
    }
  });
  

  app.get('/events', async (req, res) => {
    try {
        const events = await sql`
            SELECT * FROM savedate;  
        `;
        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events', details: error.message });
    }
});


  app.post('/events', async (req, res) => {
    const { date, title, description } = req.body;

    if (!date || !title || !description) {
        return res.status(400).json({ error: 'Missing required properties' });
    }

    try {
        const result = await sql`
            INSERT INTO savedate (date, title, description)
            VALUES (${date}, ${title}, ${description})
            RETURNING *; -- Retourne l'élément inséré
        `;
        res.status(201).json(result);
    } catch (error) {
        console.error('Error inserting event:', error);
        res.status(500).json({ error: 'Failed to insert event', details: error.message });
    }
});



app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
