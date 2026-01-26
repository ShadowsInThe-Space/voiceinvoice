/**
 * Setup Script: Create Chirp 3 Custom Recognizer
 *
 * This script creates a custom recognizer in the EU region
 * that uses the Chirp 3 model for German invoice transcription.
 *
 * Prerequisites:
 * - Google Cloud SDK installed and authenticated
 * - GOOGLE_CLOUD_PROJECT environment variable set
 * - Speech-to-Text API enabled in the project
 *
 * Run with: npx tsx scripts/setup-chirp3-recognizer.ts
 */

import { SpeechClient } from '@google-cloud/speech/build/src/v2';
import type { google } from '@google-cloud/speech/build/protos/protos';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from apps/desktop
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'eu';
const RECOGNIZER_ID = process.env.CHIRP3_RECOGNIZER || 'invoice-chirp3-de';

// Regional API endpoints for Speech-to-Text v2
// See: https://cloud.google.com/speech-to-text/v2/docs/endpoints
const REGIONAL_ENDPOINTS: Record<string, string> = {
  'us': 'us-speech.googleapis.com',
  'eu': 'eu-speech.googleapis.com',
  'global': 'speech.googleapis.com',
};

if (!PROJECT_ID) {
  console.error('Error: GOOGLE_CLOUD_PROJECT environment variable not set');
  console.error('Set it in apps/desktop/.env or export it in your shell');
  process.exit(1);
}

async function createChirp3Recognizer(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Chirp 3 Custom Recognizer Setup');
  console.log('='.repeat(60));
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Location: ${LOCATION}`);
  console.log(`Recognizer ID: ${RECOGNIZER_ID}`);
  console.log('');

  // Use regional endpoint for EU
  const apiEndpoint = REGIONAL_ENDPOINTS[LOCATION] || REGIONAL_ENDPOINTS['global'];
  console.log(`Using API endpoint: ${apiEndpoint}`);
  console.log('');

  const client = new SpeechClient({
    apiEndpoint: apiEndpoint,
  });

  // Check if recognizer already exists
  const recognizerName = `projects/${PROJECT_ID}/locations/${LOCATION}/recognizers/${RECOGNIZER_ID}`;

  try {
    console.log('Checking if recognizer already exists...');
    const [existingRecognizer] = await client.getRecognizer({
      name: recognizerName,
    });

    if (existingRecognizer) {
      console.log('Recognizer already exists!');
      console.log(`   Name: ${existingRecognizer.name}`);
      console.log(`   Model: ${existingRecognizer.defaultRecognitionConfig?.model}`);
      console.log(`   Languages: ${existingRecognizer.defaultRecognitionConfig?.languageCodes?.join(', ')}`);
      console.log('');
      console.log('No action needed. Use this recognizer path in your code:');
      console.log(`   ${recognizerName}`);
      return;
    }
  } catch {
    // Recognizer doesn't exist, create it
    console.log('Recognizer not found. Creating new one...');
  }

  // Create recognizer configuration
  const recognizerConfig: google.cloud.speech.v2.IRecognizer = {
    defaultRecognitionConfig: {
      model: 'chirp_3',
      languageCodes: ['de-DE'], // German
      features: {
        enableAutomaticPunctuation: true,
      },
    },
  };

  const request: google.cloud.speech.v2.ICreateRecognizerRequest = {
    parent: `projects/${PROJECT_ID}/locations/${LOCATION}`,
    recognizerId: RECOGNIZER_ID,
    recognizer: recognizerConfig,
  };

  console.log('Creating Chirp 3 recognizer...');
  console.log('');

  try {
    const [operation] = await client.createRecognizer(request);

    console.log('Waiting for operation to complete...');
    const [recognizer] = await operation.promise();

    console.log('');
    console.log('Recognizer created successfully!');
    console.log('='.repeat(60));
    console.log(`Name: ${recognizer.name}`);
    console.log(`Model: ${recognizer.defaultRecognitionConfig?.model}`);
    console.log(`Languages: ${recognizer.defaultRecognitionConfig?.languageCodes?.join(', ')}`);
    console.log(`State: ${recognizer.state}`);
    console.log('');
    console.log('Your .env already has:');
    console.log(`CHIRP3_RECOGNIZER=${RECOGNIZER_ID}`);
    console.log('');
    console.log('Full recognizer path:');
    console.log(`${recognizer.name}`);
    console.log('');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = (error as { code?: number })?.code;
    console.error('');
    console.error('Failed to create recognizer!');
    console.error('Error:', errorMessage);

    if (errorCode === 6) {
      console.error('');
      console.error('The recognizer already exists. Use:');
      console.error(`   ${recognizerName}`);
    } else if (errorCode === 7) {
      console.error('');
      console.error('Permission denied. Make sure:');
      console.error('1. Speech-to-Text API is enabled');
      console.error('2. You have the right permissions');
      console.error('');
      console.error('Enable API with:');
      console.error(`   gcloud services enable speech.googleapis.com --project=${PROJECT_ID}`);
    } else if (errorCode === 3) {
      console.error('');
      console.error('Invalid argument. Check that:');
      console.error('- chirp_3 model is available in the EU region');
      console.error('- Language code de-DE is supported');
    }

    process.exit(1);
  }
}

// Run the setup
createChirp3Recognizer().catch(console.error);
