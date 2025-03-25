class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
    this.usageCount = 0;
  }
}

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export class Trie {
  constructor() {
    this.root = new TrieNode();
    this.cache = new Map();
  }

  insert(word) {
    let node = this.root;
    for (const char of word.toLowerCase()) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char);
    }
    node.isEndOfWord = true;
    node.usageCount++;
  }

  search(prefix, limit = 10) {
    return this.fuzzySearch(prefix, 0, limit);
  }

  fuzzySearch(query, maxDistance = 2, limit = 10) {
    query = query.toLowerCase();
    const cacheKey = `${query}:${maxDistance}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const results = [];
    this._fuzzySearch(this.root, '', query, maxDistance, results);

    // Score and sort results
    const scoredResults = results.map(word => ({
      word,
      score: this._calculateScore(query, word)
    })).sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.word);

    this.cache.set(cacheKey, scoredResults);
    return scoredResults;
  }

  _calculateScore(query, word) {
    const prefixWeight = 0.6;
    const similarityWeight = 0.3;
    const usageWeight = 0.1;

    // Prefix match quality
    const prefixMatch = word.toLowerCase().startsWith(query.toLowerCase()) ? 1 : 0;
    
    // Similarity score (inverse of distance)
    const maxLen = Math.max(query.length, word.length);
    const distance = levenshteinDistance(query, word);
    const similarity = 1 - (distance / maxLen);
    
    // Get usage count from node
    let node = this.root;
    for (const char of word.toLowerCase()) {
      node = node.children.get(char);
    }
    const usage = Math.min(node.usageCount / 10, 1); // Normalized to 0-1

    return (prefixWeight * prefixMatch) + 
           (similarityWeight * similarity) + 
           (usageWeight * usage);
  }

  _fuzzySearch(node, currentWord, query, maxDistance, results, depth = 0) {
    if (node.isEndOfWord && depth >= query.length - maxDistance) {
      results.push(currentWord);
    }

    for (const [char, childNode] of node.children) {
      const nextWord = currentWord + char;
      const queryChar = query[depth];
      
      if (queryChar && (char === queryChar || 
          levenshteinDistance(char, queryChar) <= maxDistance)) {
        this._fuzzySearch(childNode, nextWord, query, maxDistance, results, depth + 1);
      } else if (!queryChar || depth >= query.length - maxDistance) {
        this._fuzzySearch(childNode, nextWord, query, maxDistance, results, depth + 1);
      }
    }
  }

  _collectWords(node, currentWord, results, limit) {
    if (results.length >= limit) return;
    if (node.isEndOfWord) {
      results.push(currentWord);
    }

    for (const [char, childNode] of node.children) {
      this._collectWords(childNode, currentWord + char, results, limit);
    }
  }
}
