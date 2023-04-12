const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { loadModel, loadDocuments, buildQuery } = require('./model.js')

const modelPath = './models/wiki.en.align.partial.vec';

let model, documents, query;

console.log('Loading the model')
loadModel(modelPath).then(m => {
    console.log(`Model loaded with ${Array.from(m.keys()).length} words`);
    model = m
    documents = loadDocuments('./materials/', model)
    query = buildQuery(model, documents, 5)
  })

const app = express();

// Use body-parser middleware to parse JSON requests
app.use(bodyParser.json());

// Read the secret key from a file
const secretKey = fs.readFileSync('secret.key', 'utf8');

// Serve static files in the "public" directory
app.use(express.static('public'));

// Set up a route to serve the HTML file
app.get('*', (req, res) => {
  // Try to serve the requested file based on the path
  const fileName = req.path + '.html';
  const filePath = path.join(__dirname, 'public', fileName);
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      // If the file is not found, serve the "index.html" file
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
      // If the file is found, serve it
      res.sendFile(filePath);
    }
  });
});

// Set up a route to handle POST requests
app.post('/search', (req, res) => {
  // Verify that the request includes a token
  const token = req.body.token;
  if (!token) {
    return res.status(401).send('Missing token');
  }
  
  if (token !== secretKey) {
    return res.status(401).send('unauthorized access')
  }

    // Parse the search query from the request
    const q = req.body.query;
    if (!q) {
      return res.status(400).send('Missing search query');
    }

    const results = query(q).map(doc => ({
      title: doc.title,
      content: doc.content
    }))

    // Send the search results as the response
    return res.send(results);
});

// Start the server
app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
