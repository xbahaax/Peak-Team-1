const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      // Configure your email service here
      // Example for Gmail:
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  async sendInterestEmail(enterpriseData) {
    const emailTemplate = this.generateEmailTemplate(enterpriseData);

    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.NOTIFICATION_EMAIL, // Email where you want to receive notifications
        subject: `New Interest from ${enterpriseData["Nom de l'entreprise"]}`,
        html: emailTemplate
      });

      console.log(`Interest email sent for ${enterpriseData["Nom de l'entreprise"]}`);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  generateEmailTemplate(enterprise) {
    return `
      <h2>New Enterprise Interest</h2>
      <p>An enterprise has shown interest in the event.</p>
      
      <h3>Enterprise Details:</h3>
      <ul>
        <li><strong>Name:</strong> ${enterprise["Nom de l'entreprise"]}</li>
        <li><strong>Contact Person:</strong> ${enterprise["Votre poste"]}</li>
        <li><strong>Address:</strong> ${enterprise["Adresse"]}</li>
        <li><strong>Phone:</strong> ${enterprise["Numéro de téléphone"]}</li>
        <li><strong>Email:</strong> ${enterprise["E-mail"]}</li>
        <li><strong>Website:</strong> ${enterprise["Site Web"] || 'N/A'}</li>
      </ul>

      <h3>Event Participation Details:</h3>
      <ul>
        <li><strong>Number of Representatives:</strong> ${enterprise["Combien de représentants de votre entreprise seront au salon ? (le nombre est limité à 3)"]}</li>
        <li><strong>Previous Participation:</strong> ${enterprise["Avez-vous déjà participé au S2EE ?"]}</li>
        <li><strong>Interested Profiles:</strong> ${enterprise["Quels profils vous intéressent ?"]}</li>
        <li><strong>Job Offerings:</strong> ${enterprise["Nombre de postes d'emploi :"]}</li>
        <li><strong>Internship Offerings:</strong> ${enterprise["Nombre de stages :"]}</li>
      </ul>
    `;
  }
}

module.exports = new EmailService(); 