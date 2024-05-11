const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const corsOptions = {
  origin: ['https://main--dreamy-kitten-353dc9.netlify.app', 'https://dreamy-kitten-353dc9.netlify.app'],
  optionsSuccessStatus: 200  
};

app.use(cors(corsOptions));

app.use(express.json());

const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
  ssl: {
      rejectUnauthorized: false // Pour des connexions sécurisées; ajustez selon vos besoins.
  }
});

// Gestionnaire pour supprimer un événement
app.delete('/events/:id', async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Missing or invalid property: id' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM savedate WHERE id = $1 RETURNING *;',
      [parseInt(id, 10)]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event', details: error.message });
  }
});

// Gestionnaire pour obtenir tous les événements
app.get('/events', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM savedate;');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events', details: error.message });
  }
});

// Gestionnaire pour ajouter un nouvel événement
app.post('/events', async (req, res) => {
  const { date, title, description } = req.body;

  if (!date || !title || !description) {
    return res.status(400).json({ error: 'Missing required properties' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO savedate (date, title, description) VALUES ($1, $2, $3) RETURNING *;',
      [date, title, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error inserting event:', error);
    res.status(500).json({ error: 'Failed to insert event', details: error.message });
  }
});




app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
