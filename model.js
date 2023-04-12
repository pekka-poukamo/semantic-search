const fs = require('fs');
const readline = require('readline')
const nlp = require('compromise');

async function loadModel(path) {
  const wordVectors = new Map();
  
  const fileStream = fs.createReadStream(path);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let isFirstLine = true;
  let counter = 0;
  for await (const line of rl) {
   if (isFirstLine) {
    isFirstLine = false;
    continue; // skip the first line
   }
   
    const [word, ...vector] = line.split(' ');
    const floatVector = vector.map(parseFloat);
    if (floatVector.length !== 300) {
      break
    }
    wordVectors.set(word, floatVector);
    counter++;
    if (counter === 20000) {
      break;
    }
  }

  rl.close()
  return wordVectors;
}
 

function removeNonTextChars(str) {
  return str.replace(/[^\p{L}\s]/gu, '');
}

function tokenize(sentence) {
  let doc = nlp(removeNonTextChars(sentence).toLowerCase());
  return doc.terms().json().map(o => o.text);
}

function getSentences(str) {
  let doc = nlp(str);
  return doc.json().map(o => o.text)
}

function cosineDistance(vector1, vector2) {
  if (vector1.length !== vector2.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
    magnitude1 += vector1[i] ** 2;
    magnitude2 += vector2[i] ** 2;
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  return 1 - (dotProduct / (magnitude1 * magnitude2));
}

function loadDocuments(folderPath, model) {
  const fileNames = fs.readdirSync(folderPath);
  const documents = [];

  for (const fileName of fileNames) {
    const filePath = `${folderPath}/${fileName}`;
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const firstLineBreak = fileContent.indexOf('\n')
    
    const documentVector = getDocumentVector(model)(fileContent)

    documents.push({
      title: fileName,
      vector: documentVector,
   content: fileContent.substring(firstLineBreak + 1, firstLineBreak + 241) + '...'
    })
  }
  
  return documents
}

const getDocumentVector = model => string => {
  return getSentences(string)
  .flatMap(tokenize)
  .map(token => model.get(token))
  .filter(vector => vector !== undefined)
  .reduce(
      (acc, vector) => acc.map((val, i) => val + vector[i]),
      Array(300).fill(0)
    )
    .map((val) => val / 300);
}

const buildQuery = (model, documents, maxResults) => query => {
  const queryVector = getDocumentVector(model)(query)
  
  return documents.sort((document1, document2) => {
    const distance1 = cosineDistance(document1.vector, queryVector);
    const distance2 = cosineDistance(document2.vector, queryVector);
    
    return distance1 - distance2;
  }).slice(0, maxResults);

}


async function main() {
  const modelPath = 'models/wiki.en.align.partial.vec';
  const model = loadModel(modelPath);
  const documents = loadDocuments('./materials/', model)
  
  const query = buildQuery(model, documents, 5)
  
  console.log(query('testing ai based semantic search').map(document => document.title))
  console.log(query('I\'m a senior ux designer, working on complex topics.').map(document => document.title))
  
}

//main();

module.exports = {
  loadModel: loadModel,
  loadDocuments: loadDocuments,
  buildQuery: buildQuery
}