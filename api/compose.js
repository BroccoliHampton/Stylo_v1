// api/compose.js

/**
 * Vercel Serverless Function to securely proxy requests to the ElevenLabs Music API.
 * Assumes the ELEVENLABS_API_KEY is set as an environment variable in Vercel.
 */

// Define the ElevenLabs Music Generation API Endpoint
const ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/music-generation';

export default async function handler(request, response) {
    // 1. **Security Check: API Key**
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
        return response.status(500).json({ 
            error: 'Server configuration error', 
            detail: 'ELEVENLABS_API_KEY environment variable is not set.' 
        });
    }

    // 2. **Method Check: Only POST is allowed**
    if (request.method !== 'POST') {
        return response.status(405).json({ 
            error: 'Method Not Allowed', 
            detail: 'This endpoint only accepts POST requests.' 
        });
    }

    // 3. **Extract Prompt from Request Body**
    const { prompt } = request.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
        return response.status(400).json({ 
            error: 'Bad Request', 
            detail: 'Missing or invalid "prompt" in request body.' 
        });
    }
    
    console.log(`Received prompt: "${prompt}"`);

    try {
        // 4. **Call the ElevenLabs API**
        const elevenLabsResponse = await fetch(ELEVENLABS_URL, {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey, 
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: prompt,
            }),
        });

        // 5. **Handle API Errors**
        if (!elevenLabsResponse.ok) {
            let errorDetail = `ElevenLabs API failed with status ${elevenLabsResponse.status}.`;
            try {
                const errorJson = await elevenLabsResponse.json();
                errorDetail = errorJson.detail || errorJson.error || JSON.stringify(errorJson);
            } catch (e) {
                // If it's not JSON, just use the status
            }
            console.error('ElevenLabs API Error:', errorDetail);
            return response.status(elevenLabsResponse.status).json({ 
                error: 'ElevenLabs API Error', 
                detail: errorDetail 
            });
        }
        
        // 6. **Convert Stream to Buffer and Send**
        // Vercel serverless functions need to send the complete response
        // We can't use .pipe() in this environment
        
        const contentType = elevenLabsResponse.headers.get('Content-Type') || 'audio/mpeg';
        
        // Convert the response to an ArrayBuffer
        const audioBuffer = await elevenLabsResponse.arrayBuffer();
        
        // Set appropriate headers
        response.setHeader('Content-Type', contentType);
        response.setHeader('Content-Length', audioBuffer.byteLength);
        
        // Send the buffer
        response.status(200).send(Buffer.from(audioBuffer));

    } catch (error) {
        console.error('Proxy Catch Block Error:', error);
        return response.status(500).json({ 
            error: 'Internal Server Error', 
            detail: error.message 
        });
    }
}
