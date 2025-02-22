const fs = require("fs");

// Google Sheets JSON URL - adding /edit?usp=sharing to make it public
const url = "https://docs.google.com/spreadsheets/d/1Yw_L2Oo7Eckx0587PEeFcRvnfIYajgNCuoz88wzR7Eg/edit?usp=sharing";

async function fetchAndSaveGoogleSheet(sheetId, outputPath) {
  try {
    const fetch = (await import('node-fetch')).default;
    
    // Add DNS check
    const dns = require('dns');
    await new Promise((resolve, reject) => {
      dns.lookup('docs.google.com', (err) => {
        if (err) {
          reject(new Error('Cannot resolve docs.google.com. Please check your internet connection.'));
        }
        resolve();
      });
    });
    
    const apiUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    
    const response = await fetch(apiUrl, {
      timeout: 10000, // Add timeout of 10 seconds
      headers: {
        'User-Agent': 'Mozilla/5.0' // Add user agent to prevent potential blocks
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }
    
    const text = await response.text();
    
    // Split into lines and parse CSV
    const lines = text.split('\n');
    const keys = lines[0].split(',').map(key => key.trim().replace(/^"|"$/g, ''));
    
    const formattedData = lines.slice(1).map(line => {
      const values = line.split(',').map(value => value.trim().replace(/^"|"$/g, ''));
      const rowData = {};
      keys.forEach((key, index) => {
        rowData[key] = values[index] || '';
      });
      return rowData;
    });

    fs.writeFileSync(
      outputPath, 
      JSON.stringify(formattedData, null, 2), 
      "utf8"
    );
    
    console.log(`JSON file saved successfully to ${outputPath}!`);
    return true;
  } catch (error) {
    console.error("Error fetching or saving data:", error);
    if (error.code === 'ENOTFOUND') {
      console.error("Network error: Cannot connect to docs.google.com. Please check your internet connection.");
    }
    return false;
  }
}

// Sheet ID from your Google Sheets URL
const sheetId = "1Yw_L2Oo7Eckx0587PEeFcRvnfIYajgNCuoz88wzR7Eg";
fetchAndSaveGoogleSheet(sheetId, "sheet_data.json");

// Export the function
module.exports = {
  fetchAndSaveGoogleSheet
};