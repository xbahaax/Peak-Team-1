const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const dataFilePath = path.join(__dirname, '../data/clean_sheet_data.json');

const authMiddleware = require('../apis/authMiddleware');
const emailService = require('../services/emailService');
const Auth = require('../apis/auth');

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
 * Read JSON file and parse it.
 */
function readData() {
    try {
        const rawData = fs.readFileSync(dataFilePath, 'utf8');
        return JSON.parse(rawData);
    } catch (err) {
        console.error('Error reading data file:', err);
        return [];
    }
}

/**
 * Write data back to JSON file.
 */
function writeData(data) {
    try {
        fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('Error writing to data file:', err);
    }
}

/**
 * @swagger
 * /api/enterprise/{name}:
 *   get:
 *     summary: Get enterprise contact details by name (Admin and Organizer only)
 *     tags: [Enterprise]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Enterprise name
 *     responses:
 *       200:
 *         description: Enterprise contact details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 position:
 *                   type: string
 *                 address:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 email:
 *                   type: string
 *                 website:
 *                   type: string
 *                 contact_status:
 *                   type: string
 *                 contact_result:
 *                   type: string
 *                 number_of_calls:
 *                   type: integer
 *                   description: Number of times the enterprise has been called
 *       404:
 *         description: Enterprise not found
 */
router.get('/:name', 
    authMiddleware,
    checkRole(['Admin', 'Organizer']),
    (req, res) => {
    const enterprises = readData();
    const enterprise = enterprises.find(e => e["Nom de l'entreprise"]?.toLowerCase() === req.params.name.toLowerCase());

    if (!enterprise) {
        return res.status(404).json({ error: 'Enterprise not found' });
    }

    res.json(enterprise);
});

/**
 * @swagger
 * /api/enterprise/{name}/status:
 *   put:
 *     summary: Update enterprise contact status and result (Admin and Organizer only)
 *     tags: [Enterprise]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: name
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
 *               contact_status:
 *                 type: string
 *                 enum: [pending, contacted, failed]
 *               contact_result:
 *                 type: string
 */
router.put('/:name/status', 
    authMiddleware,
    checkRole(['Admin', 'Organizer']),
    async (req, res) => {
    const { contact_status, contact_result } = req.body;
    let enterprises = readData();
    
    const index = enterprises.findIndex(e => e["Nom de l'entreprise"]?.toLowerCase() === req.params.name.toLowerCase());
    
    if (index === -1) {
        return res.status(404).json({ error: 'Enterprise not found' });
    }

    // Update enterprise details
    enterprises[index].contact_status = contact_status || enterprises[index].contact_status;
    enterprises[index].contact_result = contact_result || enterprises[index].contact_result;

    // Send email if contact_result is set to "interested"
    if (contact_result === 'interested') {
        try {
            await emailService.sendInterestEmail(enterprises[index]);
        } catch (error) {
            console.error('Failed to send interest email:', error);
            // Continue with the update even if email fails
        }
    }

    // Write updated data back to JSON file
    writeData(enterprises);

    res.json({ 
        message: 'Status updated successfully',
        emailSent: contact_result === 'interested'
    });
});

/**
 * @swagger
 * /api/enterprise/{name}:
 *   patch:
 *     summary: Partially update enterprise details (Admin and Organizer only)
 *     tags: [Enterprise]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: name
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
 */
router.patch('/:name', 
    authMiddleware,
    checkRole(['Admin', 'Organizer']),
    (req, res) => {
    const { updates } = req.body;
    let enterprises = readData();
    
    const index = enterprises.findIndex(e => e["Nom de l'entreprise"]?.toLowerCase() === req.params.name.toLowerCase());
    
    if (index === -1) {
        return res.status(404).json({ error: 'Enterprise not found' });
    }

    enterprises[index] = { ...enterprises[index], ...updates };
    writeData(enterprises);

    res.json({
        message: 'Enterprise updated successfully',
        updatedEnterprise: enterprises[index]
    });
});

/**
 * @swagger
 * /api/enterprise/{name}:
 *   delete:
 *     summary: Delete an enterprise (Admin only)
 *     tags: [Enterprise]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Enterprise deleted successfully
 *       404:
 *         description: Enterprise not found
 */
router.delete('/:name', 
    authMiddleware,
    checkRole(['Admin']),
    (req, res) => {
    let enterprises = readData();
    
    const index = enterprises.findIndex(e => e["Nom de l'entreprise"]?.toLowerCase() === req.params.name.toLowerCase());
    
    if (index === -1) {
        return res.status(404).json({ error: 'Enterprise not found' });
    }

    enterprises.splice(index, 1);
    writeData(enterprises);

    res.json({ message: 'Enterprise deleted successfully' });
});

/**
 * @swagger
 * /api/enterprise:
 *   get:
 *     summary: Get all enterprises (Admin and Organizer only)
 *     tags: [Enterprise]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: List of all enterprises
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   position:
 *                     type: string
 *                   address:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   email:
 *                     type: string
 *                   website:
 *                     type: string
 *                   contact_status:
 *                     type: string
 *                   contact_result:
 *                     type: string
 *                   number_of_calls:
 *                     type: integer
 *                     description: Number of times the enterprise has been called
 *       403:
 *         description: Forbidden - User must be an Admin or Organizer
 */
router.get('/',
  authMiddleware,
  checkRole(['Admin', 'Organizer']),
  (req, res) => {
    try {
      const enterprises = readData();
      res.json(enterprises);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/enterprise/create:
 *   post:
 *     summary: Create a new enterprise (Admin only)
 *     tags: [Enterprise]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - enterpriseData
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               enterpriseData:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   position:
 *                     type: string
 *                   address:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   email:
 *                     type: string
 *                   website:
 *                     type: string
 */
router.post('/create',
  authMiddleware,
  checkRole(['Admin']),
  async (req, res) => {
    try {
      const { username, password, enterpriseData } = req.body;

      // Create enterprise user account
      const userId = await Auth.register(username, password, 'Enterprise');

      // Read existing data
      let enterprises = [];
      try {
        enterprises = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
      } catch (error) {
        console.error('Error reading file:', error);
        enterprises = [];
      }

      // Format enterprise data
      const newEnterprise = {
        "Nom de l'entreprise": enterpriseData.name,
        "Votre poste": enterpriseData.position,
        "Adresse": enterpriseData.address,
        "Numéro de téléphone": enterpriseData.phone,
        "E-mail": enterpriseData.email,
        "Site Web": enterpriseData.website,
        "contact_status": "pending",
        "contact_result": null,
        "number_of_calls": 0,
        "userId": userId // Link to the user account
      };

      // Add to enterprises array
      enterprises.push(newEnterprise);

      // Write back to file
      fs.writeFileSync(dataFilePath, JSON.stringify(enterprises, null, 2), 'utf8');

      // Send confirmation email if email service is configured
      try {
        await emailService.sendInterestEmail(newEnterprise);
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Continue even if email fails
      }

      res.status(201).json({
        success: true,
        message: 'Enterprise created successfully',
        userId,
        enterprise: newEnterprise
      });

    } catch (error) {
      console.error('Error creating enterprise:', error);
      res.status(500).json({ error: error.message });
    }
});

module.exports = router;
