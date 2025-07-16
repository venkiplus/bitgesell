const request = require('supertest');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const itemsRouter = require('../../src/routes/items');

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/api/items', itemsRouter);

// Error handling middleware for tests
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal server error' 
  });
});

// Mock data
const mockItems = [
  { id: 1, name: 'Test Item 1', createdAt: '2023-01-01T00:00:00.000Z' },
  { id: 2, name: 'Test Item 2', createdAt: '2023-01-02T00:00:00.000Z' },
  { id: 3, name: 'Another Test', createdAt: '2023-01-03T00:00:00.000Z' }
];

// Mock the fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn()
  }
}));

describe('Items Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.mkdir.mockResolvedValue();
  });

  describe('GET /api/items', () => {
    it('should return paginated items with default pagination', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockItems));

      const response = await request(app)
        .get('/api/items')
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.items).toHaveLength(3);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 3,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      });
    });

    it('should handle pagination correctly', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockItems));

      const response = await request(app)
        .get('/api/items?page=1&limit=2')
        .expect(200);

      expect(response.body.items).toHaveLength(2);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
        hasNext: true,
        hasPrev: false
      });
    });

    it('should filter items by search query', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockItems));

      const response = await request(app)
        .get('/api/items?q=Test Item')
        .expect(200);

      expect(response.body.items).toHaveLength(2);
      expect(response.body.items.every(item => item.name.includes('Test Item'))).toBe(true);
    });

    it('should handle case-insensitive search', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockItems));

      const response = await request(app)
        .get('/api/items?q=another')
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].name).toBe('Another Test');
    });

    it('should validate pagination limits', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockItems));

      const response = await request(app)
        .get('/api/items?limit=500&page=0')
        .expect(200);

      expect(response.body.pagination.limit).toBe(100); // Max limit
      expect(response.body.pagination.page).toBe(1); // Min page
    });

    it('should handle empty search results', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockItems));

      const response = await request(app)
        .get('/api/items?q=nonexistent')
        .expect(200);

      expect(response.body.items).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
      expect(response.body.pagination.totalPages).toBe(1);
    });

    it('should handle missing data file (ENOENT)', async () => {
      const enoentError = new Error('File not found');
      enoentError.code = 'ENOENT';
      fs.readFile.mockRejectedValue(enoentError);
      fs.writeFile.mockResolvedValue();

      const response = await request(app)
        .get('/api/items')
        .expect(200);

      expect(response.body.items).toHaveLength(0);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('items.json'),
        '[]',
        'utf8'
      );
    });

    it('should handle invalid JSON in file', async () => {
      fs.readFile.mockResolvedValue('invalid json');

      await request(app)
        .get('/api/items')
        .expect(500);
    });

    it('should handle non-array data in file', async () => {
      fs.readFile.mockResolvedValue('{"not": "an array"}');

      await request(app)
        .get('/api/items')
        .expect(500);
    });
  });

  describe('GET /api/items/:id', () => {
    it('should return specific item when found', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockItems));

      const response = await request(app)
        .get('/api/items/1')
        .expect(200);

      expect(response.body).toEqual(mockItems[0]);
    });

    it('should return 404 when item not found', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockItems));

      const response = await request(app)
        .get('/api/items/999')
        .expect(404);

      expect(response.body.error).toContain('Item with ID 999 not found');
    });

    it('should return 400 for invalid ID parameter', async () => {
      const response = await request(app)
        .get('/api/items/abc')
        .expect(400);

      expect(response.body.error).toContain('Invalid item ID');
    });

    it('should return 400 for zero or negative ID', async () => {
      const response = await request(app)
        .get('/api/items/0')
        .expect(400);

      expect(response.body.error).toContain('Invalid item ID');
    });

    it('should handle file read error', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      await request(app)
        .get('/api/items/1')
        .expect(500);
    });
  });

  describe('POST /api/items', () => {
    beforeEach(() => {
      // Mock Date.now() for consistent testing
      jest.spyOn(Date, 'now').mockReturnValue(1234567890);
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2023-01-01T00:00:00.000Z');
    });

    afterEach(() => {
      Date.now.mockRestore();
      Date.prototype.toISOString.mockRestore();
    });

    it('should create new item successfully', async () => {
      const newItem = { name: 'New Item' };
      fs.readFile.mockResolvedValue(JSON.stringify(mockItems));
      fs.writeFile.mockResolvedValue();

      const response = await request(app)
        .post('/api/items')
        .send(newItem)
        .expect(201);

      expect(response.body).toEqual({
        id: 1234567890,
        name: 'New Item',
        createdAt: '2023-01-01T00:00:00.000Z'
      });
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should trim whitespace from item name', async () => {
      const newItem = { name: '  Trimmed Item  ' };
      fs.readFile.mockResolvedValue(JSON.stringify(mockItems));
      fs.writeFile.mockResolvedValue();

      const response = await request(app)
        .post('/api/items')
        .send(newItem)
        .expect(201);

      expect(response.body.name).toBe('Trimmed Item');
    });

    it('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/api/items')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('Item name is required');
    });

    it('should return 400 for empty name', async () => {
      const response = await request(app)
        .post('/api/items')
        .send({ name: '' })
        .expect(400);

      expect(response.body.error).toContain('Item name is required');
    });

    it('should return 400 for whitespace-only name', async () => {
      const response = await request(app)
        .post('/api/items')
        .send({ name: '   ' })
        .expect(400);

      expect(response.body.error).toContain('Item name is required');
    });

    it('should return 400 for non-string name', async () => {
      const response = await request(app)
        .post('/api/items')
        .send({ name: 123 })
        .expect(400);

      expect(response.body.error).toContain('Item name is required');
    });

    it('should return 400 for name too long', async () => {
      const longName = 'a'.repeat(201);
      const response = await request(app)
        .post('/api/items')
        .send({ name: longName })
        .expect(400);

      expect(response.body.error).toContain('Item name must be 200 characters or less');
    });

    it('should return 409 for duplicate name (case-insensitive)', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockItems));

      const response = await request(app)
        .post('/api/items')
        .send({ name: 'test item 1' }) // lowercase version of existing item
        .expect(409);

      expect(response.body.error).toContain('An item with this name already exists');
    });

    it('should handle file read error during creation', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      await request(app)
        .post('/api/items')
        .send({ name: 'Test Item' })
        .expect(500);
    });

    it('should handle file write error during creation', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockItems));
      fs.writeFile.mockRejectedValue(new Error('Write failed'));

      await request(app)
        .post('/api/items')
        .send({ name: 'Unique Item' })
        .expect(500);
    });

    it('should handle invalid JSON in existing file', async () => {
      fs.readFile.mockResolvedValue('invalid json');

      await request(app)
        .post('/api/items')
        .send({ name: 'Test Item' })
        .expect(500);
    });

    it('should handle mkdir error', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockItems));
      fs.mkdir.mockRejectedValue(new Error('Mkdir failed'));
      fs.writeFile.mockRejectedValue(new Error('Write failed'));

      await request(app)
        .post('/api/items')
        .send({ name: 'Unique Item' })
        .expect(500);
    });
  });
});