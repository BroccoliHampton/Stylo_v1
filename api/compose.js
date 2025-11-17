// This file assumes a Vercel deployment where the API key is stored 
// as an Environment Variable named ELEVENLABS_API_KEY.

import { URL } from 'url';

// Handler for the Vercel Serverless Function
export default async function handler(req, res) {
    // 1. Check for POST method
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 2. Get API Key from environment variables (SECURE)
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

    if (!ELEVENLABS_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error: ELEVENLABS_API_KEY not set.' });
    }

    // 3. Extract prompt from the client request body
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Missing required parameter: prompt.' });
    }

    const elevenLabsUrl = 'https://api.elevenlabs.io/v1/music/compose';
    
    // Payload for ElevenLabs Music API
    const payload = {
        prompt: prompt,
        music_length_ms: 15000,
        model_id: "music_v1",
        force_instrumental: true,
    };

    try {
        // 4. Call ElevenLabs API (Server-to-Server, bypassing CORS)
        const elevenLabsResponse = await fetch(elevenLabsUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY, // Use the secure key
            },
            body: JSON.stringify(payload)
        });

        // 5. Handle non-OK responses from ElevenLabs
        if (!elevenLabsResponse.ok) {
            const errorBody = await elevenLabsResponse.json();
            const errorDetail = errorBody.detail || JSON.stringify(errorBody);
            // Forward the ElevenLabs error status and details to the client
            return res.status(elevenLabsResponse.status).json({
                error: 'ElevenLabs API Error',
                detail: errorDetail,
                status: elevenLabsResponse.status
            });
        }
        
        // 6. Forward successful audio response
        
        // Get the Blob data and content type
        const contentType = elevenLabsResponse.headers.get('Content-Type') || 'audio/mpeg';
        const buffer = await elevenLabsResponse.arrayBuffer();

        // Set response headers to enable client-side playback and download
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.byteLength);
        res.setHeader('Access-Control-Allow-Origin', '*'); // Crucial for CORS
        
        // Send the raw audio buffer back to the client
        return res.status(200).send(Buffer.from(buffer));

    } catch (error) {
        console.error('Proxy Fetch Error:', error);
        return res.status(500).json({ error: 'Internal server error during API proxy.', detail: error.message });
    }
}
