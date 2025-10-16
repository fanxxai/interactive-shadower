import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Get the absolute path to the public/media directory
    const mediaDir = path.join(process.cwd(), 'public', 'media');
    
    // Read the directory
    const files = fs.readdirSync(mediaDir);
    
    // Filter for media files
    const mediaFiles = files.filter(file => 
      /\.(jpg|jpeg|png|gif|mp4|webm|mov)$/i.test(file)
    );
    
    // Return the list of media files
    return NextResponse.json(mediaFiles);
  } catch (error) {
    console.error('Error scanning media directory:', error);
    return NextResponse.json({ error: 'Failed to scan media directory' }, { status: 500 });
  }
}