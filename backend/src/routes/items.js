const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const DATA_PATH = path.join(__dirname, '../../../data/items.json');

/**
 * Reads and parses the items data from the JSON file
 * @returns {Promise<Array>} Array of items
 * @throws {Error} If file cannot be read or parsed
 */
async function readData() {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf8');
    const data = JSON.parse(raw);
    
    // Ensure we always return an array
    if (!Array.isArray(data)) {
      throw new Error('Data file does not contain a valid array');
    }
    
    return data;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty array and create file
      await writeData([]);
      return [];
    }
    throw error;
  }
}

/**
 * Writes data to the JSON file with proper error handling
 * @param {Array} data - Array of items to write
 * @throws {Error} If data is not an array or write fails
 */
async function writeData(data) {
  if (!Array.isArray(data)) {
    throw new Error('Data must be an array');
  }
  
  try {
    // Ensure directory exists
    const dir = path.dirname(DATA_PATH);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    throw new Error(`Failed to write data: ${error.message}`);
  }
}

/**
 * GET /api/items - Retrieve paginated and filtered items
 * Query parameters:
 * - limit: Number of items per page (1-100, default: 10)
 * - page: Page number (min: 1, default: 1)
 * - q: Search query string (optional)
 */
router.get('/', async (req, res, next) => {
  try {
    const data = await readData();
    const { limit = 10, page = 1, q } = req.query;
    
    // Input validation
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 10));
    
    let results = data;

    // Apply search filter if query provided
    if (q && typeof q === 'string') {
      const searchTerm = q.trim().toLowerCase();
      if (searchTerm) {
        results = results.filter(item => 
          item && 
          item.name && 
          typeof item.name === 'string' &&
          item.name.toLowerCase().includes(searchTerm)
        );
      }
    }

    const total = results.length;
    const offset = (pageNum - 1) * pageSize;
    const paginatedResults = results.slice(offset, offset + pageSize);
    const totalPages = Math.ceil(total / pageSize);

    res.json({
      items: paginatedResults,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: totalPages || 1, // Ensure at least 1 page
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/items/:id - Retrieve a specific item by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate ID parameter
    const itemId = parseInt(id);
    if (isNaN(itemId) || itemId <= 0) {
      const err = new Error('Invalid item ID. Must be a positive integer.');
      err.status = 400;
      throw err;
    }
    
    const data = await readData();
    const item = data.find(i => i && i.id === itemId);
    
    if (!item) {
      const err = new Error(`Item with ID ${itemId} not found`);
      err.status = 404;
      throw err;
    }
    
    res.json(item);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/items - Create a new item
 * Body should contain: { name: string }
 */
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    
    // Validate request body
    if (!name || typeof name !== 'string' || !name.trim()) {
      const err = new Error('Item name is required and must be a non-empty string');
      err.status = 400;
      throw err;
    }
    
    // Sanitize the name
    const sanitizedName = name.trim();
    if (sanitizedName.length > 200) {
      const err = new Error('Item name must be 200 characters or less');
      err.status = 400;
      throw err;
    }
    
    const data = await readData();
    
    // Check for duplicate names (case-insensitive)
    const duplicate = data.find(item => 
      item && 
      item.name && 
      item.name.toLowerCase() === sanitizedName.toLowerCase()
    );
    
    if (duplicate) {
      const err = new Error('An item with this name already exists');
      err.status = 409;
      throw err;
    }
    
    // Create new item with timestamp-based ID
    const newItem = {
      id: Date.now(),
      name: sanitizedName,
      createdAt: new Date().toISOString()
    };
    
    data.push(newItem);
    await writeData(data);
    
    res.status(201).json(newItem);
  } catch (err) {
    next(err);
  }
});

module.exports = router;