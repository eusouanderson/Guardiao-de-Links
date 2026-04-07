// Centralized project constants used across the backend layers.
const path = require('node:path');

const DEFAULT_PUBLIC_DIR = path.join(__dirname, '..', 'public');
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
const REQUIRED_COMPLETION_COUNT = 10;
const DEFAULT_STUDY_DIFFICULTY = 'medium';
const STUDY_DIFFICULTIES = ['easy', 'medium', 'hard'];

const MIME_TYPES = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const LANGUAGE_KEYWORDS = [
  'javascript',
  'typescript',
  'python',
  'java',
  'c#',
  'csharp',
  'c++',
  'cpp',
  'ruby',
  'go',
  'golang',
  'php',
  'kotlin',
  'swift',
  'rust',
  'scala',
  'elixir',
  'haskell',
  'lua',
  'perl',
];

const FRAMEWORK_KEYWORDS = [
  'react',
  'next',
  'next.js',
  'nextjs',
  'vue',
  'nuxt',
  'nuxt.js',
  'angular',
  'svelte',
  'sveltekit',
  'nestjs',
  'express',
  'fastify',
  'spring',
  'django',
  'flask',
  'laravel',
  'rails',
  'asp.net',
  'dotnet',
  'quarkus',
];

module.exports = {
  DEFAULT_PUBLIC_DIR,
  GROQ_API_URL,
  DEFAULT_GROQ_MODEL,
  REQUIRED_COMPLETION_COUNT,
  DEFAULT_STUDY_DIFFICULTY,
  STUDY_DIFFICULTIES,
  MIME_TYPES,
  LANGUAGE_KEYWORDS,
  FRAMEWORK_KEYWORDS,
};
