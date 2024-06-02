// Importation des modules nécessaires
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { Resend } = require('resend');
const cron = require('node-cron');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const resend1 = new Resend('re_L8JyigER_4mj7zrBjx2spsZCTLuZsqyLx');
const resend2 = new Resend('re_vZfR9SCW_HDNEo88pBSQSQQrt6Akq7Vuz');

// Configuration des options CORS
const corsOptions = {
  origin: 'https://dreamy-kitten-353dc9.netlify.app',
  optionsSuccessStatus: 200  
};

app.use(cors(corsOptions));
app.use(express.json());

// Configuration de la connexion à la base de données
const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
  ssl: {
    rejectUnauthorized: false
  }
});

// Fonction pour envoyer un email avec une clé API spécifique
const sendEmail = async (resend, email, subject, html) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>',
      to: [email],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log(`Email sent to ${email}:`, data);
    }
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

// Fonction pour envoyer des emails à plusieurs adresses avec différentes clés API
const sendEmails = async (emails, subject, html) => {
  for (const email of emails) {
    if (email === 'lena.boya26@gmail.com') {
      await sendEmail(resend1, email, subject, html);
    } else if (email === 'camille.mar@live.fr') {
      await sendEmail(resend2, email, subject, html);
    }
  }
};

// Gestionnaire pour supprimer un événement
app.delete('/events/:id', async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Missing or invalid property: id' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM savedate WHERE id = $1 RETURNING title;',
      [parseInt(id, 10)]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const deletedEvent = result.rows[0];
    res.json(deletedEvent);

    // Envoi d'un email de confirmation de suppression
    await sendEmails(
      ['lena.boya26@gmail.com', 'camille.mar@live.fr'],
      'Evènement supprimé',
      `<strong>The event titled "${deletedEvent.title}" has been deleted.</strong>`
    );

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
  const { date, time, title } = req.body;

  if (!date || !time || !title) {
    return res.status(400).json({ error: 'Missing required properties' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO savedate (date, heure, title) VALUES ($1, $2, $3) RETURNING *;',
      [date, time, title]
    );
    const newEvent = result.rows[0];
    res.status(201).json(newEvent);

    // Calculer le temps jusqu'à la veille de l'événement
    const eventDate = new Date(`${date}T${time}`);
    const reminderDate = new Date(eventDate);
    reminderDate.setDate(eventDate.getDate() - 1);

    const now = new Date();
    const timeUntilReminder = reminderDate.getTime() - now.getTime();

    if (timeUntilReminder > 0) {
      setTimeout(() => {
        sendEmails(
          ['lena.boya26@gmail.com', 'camille.mar@live.fr'],
          `Rappel: ${title}`,
          `<strong>EVENEMENT:</strong><br>Date: ${date} ${time}<br>Titre: ${title}`
        );
      }, timeUntilReminder);
    }

  } catch (error) {
    console.error('Error inserting event:', error);
    res.status(500).json({ error: 'Failed to insert event', details: error.message });
  }
});

// Route pour envoyer une alerte par email
app.post('/send-alert', async (req, res) => {
  const { email, event } = req.body;

  if (!email || !event) {
    return res.status(400).json({ error: 'Missing required properties' });
  }

  try {
    await sendEmails(
      [email],
      `Rappel: ${event.title}`,
      `<strong>Rappel de l'évenement:</strong><br>Date: ${event.date} ${event.heure}<br>Titre: ${event.title}`
    );
    res.status(200).json({ message: 'Alert sent successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send alert', details: error.message });
  }
});

// Route pour tester l'envoi immédiat d'une alerte
app.post('/test-alert', async (req, res) => {
  try {
    const { rows: events } = await pool.query(
      'SELECT * FROM savedate ORDER BY date, heure LIMIT 1;'
    );

    if (events.length === 0) {
      return res.status(404).json({ error: 'No events found' });
    }

    const event = events[0];
    await sendEmails(
      ['lena.boya26@gmail.com', 'camille.mar@live.fr'],
      `Test Alert: ${event.title}`,
      `<strong>Event Reminder:</strong><br>Date: ${event.date} ${event.heure}<br>Title: ${event.title}`
    );
    res.status(200).json({ message: 'Test alert sent successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send test alert', details: error.message });
  }
});

// Fonction pour envoyer un email pour les événements du lendemain
const sendReminderEmails = async () => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const { rows: events } = await pool.query(
      'SELECT * FROM savedate WHERE date = $1;',
      [dateStr]
    );

    for (const event of events) {
      await sendEmails(
        ['lena.boya26@gmail.com', 'camille.mar@live.fr'],
        `Reminder: ${event.title}`,
        `<strong>Event Reminder:</strong><br>Date: ${event.date} ${event.heure}<br>Title: ${event.title}`
      );
    }
  } catch (error) {
    console.error('Error sending reminder emails:', error);
  }
};

// Planification de la tâche cron pour exécuter la fonction tous les jours à minuit
cron.schedule('0 0 * * *', sendReminderEmails);

// Lancement du serveur
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
