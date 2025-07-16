const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const DATA_PATH = path.join(__dirname, '../../../data/items.json');

// Cache for stats
let statsCache = null;
let lastModified = null;

// Watch for file changes to invalidate cache
fs.watchFile(DATA_PATH, (curr, prev) => {
  if (curr.mtime !== prev.mtime) {
    statsCache = null;
    lastModified = curr.mtime;
    console.log('Stats cache invalidated due to file change');
  }
});

// Function to calculate stats
function calculateStats(items) {
  return {
    total: items.length,
    averagePrice: items.length > 0 ? items.reduce((acc, cur) => acc + cur.price, 0) / items.length : 0
  };
}

// GET /api/stats
router.get('/', (req, res, next) => {
  // Check if we have cached stats
  if (statsCache) {
    console.log('Serving stats from cache');
    return res.json(statsCache);
  }

  // Read file and calculate stats
  fs.readFile(DATA_PATH, (err, raw) => {
    if (err) return next(err);

    try {
      const items = JSON.parse(raw);
      const stats = calculateStats(items);
      
      // Cache the results
      statsCache = stats;
      console.log('Stats calculated and cached');
      
      res.json(stats);
    } catch (parseErr) {
      next(parseErr);
    }
  });
});

module.exports = router;