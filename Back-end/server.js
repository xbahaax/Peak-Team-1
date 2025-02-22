const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./src/config/swagger');
const routes = require('./src/routes');
const sequelize = require('./src/config/database');
const cookieParser = require('cookie-parser');
const enterpriseQueueRoutes = require('./src/routes/enterprise.queue.routes');

const app = express();

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware if needed
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Swagger documentation route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Mount all routes under /api
app.use('/api', routes);
app.use('/api/enterprise', enterpriseQueueRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database and start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Sync all models
    await sequelize.sync();
    console.log('Database synchronized successfully');
    
    // Create default admin user if it doesn't exist
    const User = require('./src/models/user');
    const Auth = require('./src/apis/auth');
    
    const adminExists = await User.findOne({
      where: { role: 'Admin' }
    });
    
    if (!adminExists) {
      await Auth.register('admin', 'admin123', 'Admin');
      console.log('Default admin user created');
    }
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Swagger documentation available at http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
  }
}

startServer();
