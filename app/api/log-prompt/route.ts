import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, ID } from 'node-appwrite';

function getAppwriteClient() {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !apiKey) {
    throw new Error('Appwrite credentials are not configured. Please set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, and APPWRITE_API_KEY in your environment variables.');
  }

  const client = new Client();
  client
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  return client;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Validate Appwrite configuration
    const endpoint = process.env.APPWRITE_ENDPOINT;
    const projectId = process.env.APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;
    const dbId = process.env.APPWRITE_DATABASE_ID;

    if (!endpoint || !projectId || !apiKey || !dbId) {
      return NextResponse.json(
        { error: 'Appwrite is not configured. Please set all required environment variables.' },
        { status: 500 }
      );
    }

    const client = getAppwriteClient();
    const databases = new Databases(client);
    const collectionId = 'prompts';
    
    // Create document with prompt field
    const doc: Record<string, any> = {
      prompt: prompt || '',
    };

    const created = await databases.createDocument(
      dbId,
      collectionId,
      ID.unique(),
      doc
    );

    return NextResponse.json({ id: created.$id });
  } catch (error: any) {
    console.error('Error logging prompt:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to log prompt' },
      { status: 500 }
    );
  }
}
