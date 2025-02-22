const express = require('express');
const router = express.Router();
const fs = require('fs');
const authMiddleware = require('../apis/authMiddleware');
const { fetchAndSaveGoogleSheet } = require('../apis/GoogleAPI');

const SHEET_DATA_PATH = "./data/sheet_data.json";

/**
 * @swagger
 * components:
 *   schemas:
 *     SheetData:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         status:
 *           type: string
 *         # Add other sheet properties as needed
 */

const checkRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Unauthorized. Requires one of the following roles: ${roles.join(', ')}` 
      });
    }
    next();
  };
};

/**
 * @swagger
 * /api/contacts:
 *   get:
 *     summary: Get Google Sheets data (Admin and Organizer only)
 *     tags: [Contacts]
 *     security:
 *       - sessionAuth: []
 *     description: Retrieves Google Sheets data. Only accessible by users with Admin or Organizer roles.
 *     responses:
 *       200:
 *         description: Sheet data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SheetData'
 *       401:
 *         description: Unauthorized - No valid session token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be an Admin or Organizer
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Unauthorized. Requires Admin or Organizer role'
 */
router.get('/', 
  authMiddleware, 
  checkRole(['Admin', 'Organizer']), 
  async (req, res) => {
    try {
      const sheetId = "1Yw_L2Oo7Eckx0587PEeFcRvnfIYajgNCuoz88wzR7Eg";
      
      try {
        const data = JSON.parse(fs.readFileSync(SHEET_DATA_PATH, 'utf8'));
        res.json(data);
      } catch (readError) {
        if (!fs.existsSync('./data')) {
          fs.mkdirSync('./data');
        }
        await fetchAndSaveGoogleSheet(sheetId, SHEET_DATA_PATH);
        const data = JSON.parse(fs.readFileSync(SHEET_DATA_PATH, 'utf8'));
        res.json(data);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/contacts/update:
 *   put:
 *     summary: Update sheet data (Admin and Organizer only)
 *     tags: [Contacts]
 *     security:
 *       - sessionAuth: []
 *     description: Updates specific row data in the Google Sheet. Only accessible by users with Admin or Organizer roles.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rowIndex
 *               - updates
 *             properties:
 *               rowIndex:
 *                 type: integer
 *                 description: The index of the row to update
 *                 example: 1
 *               updates:
 *                 type: object
 *                 description: Key-value pairs of columns to update
 *                 example:
 *                   status: "Completed"
 *                   notes: "Updated by organizer"
 *     responses:
 *       200:
 *         description: Data updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Data updated successfully"
 *                 updatedRow:
 *                   $ref: '#/components/schemas/SheetData'
 *       401:
 *         description: Unauthorized - No valid session token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User must be an Admin or Organizer
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Unauthorized. Requires Admin or Organizer role'
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 'Invalid row index'
 */
router.put('/update', 
  authMiddleware, 
  checkRole(['Admin', 'Organizer']), 
  async (req, res) => {
    try {
      const { rowIndex, updates } = req.body;
      const data = JSON.parse(fs.readFileSync(SHEET_DATA_PATH, 'utf8'));

      if (rowIndex < 0 || rowIndex >= data.length) {
        return res.status(400).json({ error: 'Invalid row index' });
      }

      Object.keys(updates).forEach(field => {
        if (field in data[rowIndex]) {
          data[rowIndex][field] = updates[field];
        }
      });

      fs.writeFileSync(SHEET_DATA_PATH, JSON.stringify(data, null, 2));

      res.json({ 
        success: true, 
        message: 'Data updated successfully',
        updatedRow: data[rowIndex]
      });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/contacts/{id}:
 *   patch:
 *     summary: Partially update contact (Admin and Organizer only)
 *     tags: [Contacts]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               updates:
 *                 type: object
 *     responses:
 *       200:
 *         description: Contact updated successfully
 *       404:
 *         description: Contact not found
 */
router.patch('/:id',
  authMiddleware,
  checkRole(['Admin', 'Organizer']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { updates } = req.body;
      const data = JSON.parse(fs.readFileSync(SHEET_DATA_PATH, 'utf8'));

      const index = data.findIndex(item => item.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      data[index] = { ...data[index], ...updates };
      fs.writeFileSync(SHEET_DATA_PATH, JSON.stringify(data, null, 2));

      res.json({
        success: true,
        message: 'Contact updated successfully',
        updatedContact: data[index]
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/contacts/{id}:
 *   delete:
 *     summary: Delete a contact (Admin only)
 *     tags: [Contacts]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contact deleted successfully
 *       404:
 *         description: Contact not found
 */
router.delete('/:id',
  authMiddleware,
  checkRole(['Admin']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const data = JSON.parse(fs.readFileSync(SHEET_DATA_PATH, 'utf8'));

      const index = data.findIndex(item => item.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      data.splice(index, 1);
      fs.writeFileSync(SHEET_DATA_PATH, JSON.stringify(data, null, 2));

      res.json({
        success: true,
        message: 'Contact deleted successfully'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/contacts/{id}/assign:
 *   post:
 *     summary: Assign contact task to a user (Admin only)
 *     tags: [Contacts]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assignedTo
 *             properties:
 *               assignedTo:
 *                 type: string
 *                 description: User ID to assign the task to
 *     responses:
 *       200:
 *         description: Contact task assigned successfully
 *       404:
 *         description: Contact not found
 */
router.post('/:id/assign',
  authMiddleware,
  checkRole(['Admin']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;
      const data = JSON.parse(fs.readFileSync(SHEET_DATA_PATH, 'utf8'));

      const index = data.findIndex(item => item.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      data[index] = {
        ...data[index],
        assignedTo,
        contactStatus: 'assigned',
        assignedAt: new Date().toISOString(),
        contactResult: null
      };

      fs.writeFileSync(SHEET_DATA_PATH, JSON.stringify(data, null, 2));

      res.json({
        success: true,
        message: 'Contact task assigned successfully',
        updatedContact: data[index]
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/contacts/{id}/status:
 *   put:
 *     summary: Update contact status (Admin and Organizer only)
 *     tags: [Contacts]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contactStatus
 *               - contactResult
 *             properties:
 *               contactStatus:
 *                 type: string
 *                 enum: [assigned, contacting, contacted]
 *               contactResult:
 *                 type: string
 *                 enum: [interested, not_interested]
 *     responses:
 *       200:
 *         description: Contact status updated successfully
 *       404:
 *         description: Contact not found
 *       400:
 *         description: Invalid status transition
 */
router.put('/:id/status',
  authMiddleware,
  checkRole(['Admin', 'Organizer']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { contactStatus, contactResult } = req.body;
      const data = JSON.parse(fs.readFileSync(SHEET_DATA_PATH, 'utf8'));

      const index = data.findIndex(item => item.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      // Validate status transitions
      const currentStatus = data[index].contactStatus;
      const validTransitions = {
        assigned: ['contacting'],
        contacting: ['contacted'],
        contacted: ['contacted']
      };

      if (!validTransitions[currentStatus]?.includes(contactStatus)) {
        return res.status(400).json({ 
          error: `Invalid status transition from ${currentStatus} to ${contactStatus}` 
        });
      }

      // Only allow contact result when status is 'contacted'
      if (contactResult && contactStatus !== 'contacted') {
        return res.status(400).json({
          error: 'Contact result can only be set when status is contacted'
        });
      }

      // Validate that only assigned user or admin can update
      if (req.user.role !== 'Admin' && data[index].assignedTo !== req.user.id) {
        return res.status(403).json({
          error: 'Only assigned user or admin can update the contact status'
        });
      }

      data[index] = {
        ...data[index],
        contactStatus,
        lastUpdatedAt: new Date().toISOString(),
        lastUpdatedBy: req.user.id,
        ...(contactResult && { contactResult })
      };

      fs.writeFileSync(SHEET_DATA_PATH, JSON.stringify(data, null, 2));

      res.json({
        success: true,
        message: 'Contact status updated successfully',
        updatedContact: data[index]
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/contacts/assigned:
 *   get:
 *     summary: Get contacts assigned to current user (Admin and Organizer only)
 *     tags: [Contacts]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: List of assigned contacts
 */
router.get('/assigned',
  authMiddleware,
  checkRole(['Admin', 'Organizer']),
  async (req, res) => {
    try {
      const data = JSON.parse(fs.readFileSync(SHEET_DATA_PATH, 'utf8'));
      
      let assignedContacts;
      if (req.user.role === 'Admin') {
        // Admins can see all assigned contacts
        assignedContacts = data.filter(contact => contact.assignedTo);
      } else {
        // Users can only see their assigned contacts
        assignedContacts = data.filter(contact => contact.assignedTo === req.user.id);
      }

      res.json(assignedContacts);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/contacts:
 *   post:
 *     summary: Create a new contact (Admin and Organizer only)
 *     tags: [Contacts]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - "Nom de l'entreprise"
 *               - "Votre poste"
 *               - "E-mail"
 *             properties:
 *               "Nom de l'entreprise":
 *                 type: string
 *               "Votre poste":
 *                 type: string
 *               "Adresse":
 *                 type: string
 *               "Numéro de téléphone":
 *                 type: string
 *               "E-mail":
 *                 type: string
 *               "Site Web":
 *                 type: string
 *     responses:
 *       201:
 *         description: Contact created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.post('/',
  authMiddleware,
  checkRole(['Admin', 'Organizer']),
  async (req, res) => {
    try {
      const newContact = {
        "Nom de l'entreprise": req.body["Nom de l'entreprise"],
        "Votre poste": req.body["Votre poste"],
        "Adresse": req.body["Adresse"] || "",
        "Numéro de téléphone": req.body["Numéro de téléphone"] || "",
        "E-mail": req.body["E-mail"],
        "Site Web": req.body["Site Web"] || "",
        "contact_status": "pending",
        "contact_result": null,
        "number_of_calls": 0,
        "assignedTo": null,
        "id": require('crypto').randomUUID() // Generate a unique ID
      };

      // Validate required fields
      if (!newContact["Nom de l'entreprise"] || !newContact["Votre poste"] || !newContact["E-mail"]) {
        return res.status(400).json({ 
          error: "Missing required fields: Company name, position, and email are required" 
        });
      }

      // Read existing data
      const data = JSON.parse(fs.readFileSync(SHEET_DATA_PATH, 'utf8'));

      // Check if company already exists
      if (data.some(contact => contact["Nom de l'entreprise"]?.toLowerCase() === newContact["Nom de l'entreprise"].toLowerCase())) {
        return res.status(400).json({ 
          error: "A contact with this company name already exists" 
        });
      }

      // Add new contact
      data.push(newContact);

      // Write updated data back to file
      fs.writeFileSync(SHEET_DATA_PATH, JSON.stringify(data, null, 2));

      res.status(201).json({
        success: true,
        message: 'Contact created successfully',
        contact: newContact
      });
    } catch (error) {
      console.error('Error creating contact:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router; 
