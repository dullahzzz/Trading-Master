require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Middleware to check for Whop API key
const requireApiKey = (req, res, next) => {
  if (!process.env.WHOP_API_KEY) {
    return res.status(500).json({ error: 'WHOP_API_KEY not set in environment' });
  }
  next();
};

// Example endpoint: Get user memberships
app.post('/whop/getMemberships', requireApiKey, async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const response = await axios.get(`https://api.whop.com/v1/memberships?user_id=${userId}`, {
      headers: {
        Authorization: `Bearer ${process.env.WHOP_API_KEY}`,
      },
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Example endpoint: Validate license
app.post('/whop/validateLicense', requireApiKey, async (req, res) => {
  const { licenseKey } = req.body;
  if (!licenseKey) {
    return res.status(400).json({ error: 'licenseKey is required' });
  }

  try {
    const response = await axios.get(`https://api.whop.com/v1/licenses/${licenseKey}/validate`, {
      headers: {
        Authorization: `Bearer ${process.env.WHOP_API_KEY}`,
      },
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Whop MCP server listening at http://localhost:${port}`);
});
