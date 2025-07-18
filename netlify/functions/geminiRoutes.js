const fetch = require('node-fetch');

exports.handler = async function (event, context) {
    // Netlify Functions hanya menerima method POST untuk body
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { keywords } = JSON.parse(event.body);
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY tidak terdefinisi' }) };
    }
    
    const instruction = `Sebagai seorang ahli prompt engineering untuk AI image generator, buatlah sebuah paragraf tunggal yang sangat detail, deskriptif, dan sinematik berdasarkan kata kunci berikut. Prompt ini harus cocok untuk model AI text-to-image seperti Midjourney atau Stable Diffusion. Jangan tambahkan penjelasan atau teks pembuka/penutup, hanya hasilkan paragraf prompt-nya saja. Kata kunci: "${keywords}"`;
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: instruction }] }] }),
        });

        if (!response.ok) {
            const errorBody = await response.json();
            return { statusCode: response.status, body: JSON.stringify(errorBody) };
        }

        const data = await response.json();
        const generatedText = data.candidates[0].content.parts[0].text;
        
        return {
            statusCode: 200,
            body: JSON.stringify({ generated_prompt: generatedText.trim() }),
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};