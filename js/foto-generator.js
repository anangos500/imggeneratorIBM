import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

const GEMINI_API_KEY = 'AIzaSyBo04zgOkvx-pXvfFaUfvm66Ue1TGOYl9g';
const WAVESPEED_API_KEY = '37531d519f278ed59a0ffd7a3ad932e566f980c50b2d5405f4a89c1b75178321';

const promptSubject = document.getElementById('prompt-subject');
const promptStyle = document.getElementById('prompt-style');
const promptLighting = document.getElementById('prompt-lighting');
const promptDetails = document.getElementById('prompt-details');
const promptExtraDetails = document.getElementById('prompt-extra-details'); 
const generatePromptBtn = document.getElementById('generate-prompt-btn');
const generatedPromptContainer = document.getElementById('generated-prompt-container');
const generatedPromptField = document.getElementById('generated-prompt-field');
const fotoGenerateBtn = document.getElementById('foto-generate-btn');
const fotoOutput = document.getElementById('foto-output');
const fotoDownloadBtn = document.getElementById('foto-download-btn');

let fotoGeneratedImageUrl = '';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

generatePromptBtn.addEventListener('click', async () => {
  if (!promptSubject.value.trim()) {
    alert('Harap isi Subjek Utama Gambar terlebih dahulu.');
    return;
  }
  if (GEMINI_API_KEY.startsWith('GANTI_DENGAN')) {
    alert('Harap masukkan Kunci API Gemini Anda di dalam file foto-generator.js');
    return;
  }

  const keywords = `${promptSubject.value}, ${promptDetails.value}, gaya ${promptStyle.value}, pencahayaan ${promptLighting.value}, ${promptExtraDetails.value}`;
  const instruction = `Sebagai seorang ahli prompt engineering untuk AI image generator, buatlah sebuah paragraf tunggal yang sangat detail, deskriptif, dan sinematik berdasarkan kata kunci berikut. Prompt ini harus cocok untuk model AI text-to-image seperti Midjourney atau Stable Diffusion. Jangan tambahkan penjelasan atau teks pembuka/penutup, hanya hasilkan paragraf prompt-nya saja. Kata kunci: "${keywords}"`;
  
  generatePromptBtn.disabled = true;
  generatePromptBtn.textContent = 'Membuat Prompt...';
  
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await model.generateContent(instruction);
    const response = await result.response;
    const generatedText = response.text();

    generatedPromptField.value = generatedText.trim();
    generatedPromptContainer.classList.remove('hidden');
    fotoGenerateBtn.classList.remove('hidden');

  } catch (err) {
    alert(`Error saat generate prompt: ${err.message}`);
    console.error(err);
  } finally {
    generatePromptBtn.disabled = false;
    generatePromptBtn.textContent = 'Generate Prompt (AI)';
  }
});

async function pollForResult(pollUrl) {
    let pollCount = 0;
    const maxPolls = 900; 

    const intervalId = setInterval(async () => {
        pollCount++;

        if (pollCount > maxPolls) {
            clearInterval(intervalId);
            const friendlyMessage = "Proses Gagal: Waktu tunggu habis setelah 1 menit. Server mungkin sedang sibuk.";
            alert(friendlyMessage);
            fotoOutput.innerHTML = `<p class="error">${friendlyMessage}</p>`;
            fotoGenerateBtn.disabled = false;
            return;
        }

        try {
            const res = await fetch(pollUrl, {
                headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` }
            });

            if (!res.ok) {
                clearInterval(intervalId);
                throw new Error(`Gagal memeriksa status gambar. HTTP Error ${res.status}`);
            }

            const pollData = await res.json();
            const taskData = pollData.data;

            console.log(`Percobaan polling #${pollCount}: Status = ${taskData.status}`);

            if (taskData.status === 'succeeded') {
                clearInterval(intervalId);
                fotoGeneratedImageUrl = taskData.outputs[0]; 
                fotoOutput.innerHTML = `<img src="${fotoGeneratedImageUrl}" alt="Generated Image">`;
                fotoDownloadBtn.disabled = false;
                fotoGenerateBtn.disabled = false;
            } else if (taskData.status === 'failed') {
                clearInterval(intervalId);
                throw new Error(taskData.error || 'Proses generate gambar gagal di server.');
            }
        } catch (err) {
            clearInterval(intervalId);
            const friendlyMessage = `Gagal mengambil hasil gambar.\n\nAlasan: ${err.message}`;
            alert(friendlyMessage);
            console.error("Error saat polling:", err);
            fotoOutput.innerHTML = `<p class="error">${friendlyMessage}</p>`;
            fotoGenerateBtn.disabled = false;
        }
    }, 3000);
}

fotoGenerateBtn.addEventListener('click', async () => {
  const finalPrompt = generatedPromptField.value;
  if (!finalPrompt.trim()) {
    alert('Prompt dari AI kosong. Coba generate prompt lagi.');
    return;
  }
  if (WAVESPEED_API_KEY.startsWith('GANTI_DENGAN')) {
    alert('Harap masukkan Kunci API Wavespeed Anda di dalam file foto-generator.js');
    return;
  }
  
  const wavespeedAPIEndpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/flux-dev-lora';
  
  // =============================================================
  // ==== PERBAIKAN FINAL: MENYESUAIKAN REQUEST BODY ====
  // =============================================================
  const requestBody = {
    prompt: finalPrompt,
    enable_sync_mode: false,
    enable_base64_output: false,
    enable_safety_checker: true,
    guidance_scale: 3.5, // Disesuaikan dengan contoh curl
    loras: [{ path: 'strangerzonehf/Flux-Super-Realism-LoRA', scale: 1 }],
    num_images: 1,
    num_inference_steps: 28,
    output_format: 'jpeg',
    seed: -1,
    size: '1024*1024',
    // --- Parameter penting yang ditambahkan kembali ---
    image: "", 
    strength: 0.8 
  };

  fotoGenerateBtn.disabled = true;
  fotoOutput.innerHTML = '<p class="loading-text">Permintaan terkirim. Menunggu hasil gambar (bisa memakan waktu)...</p>';
  fotoDownloadBtn.disabled = true;

  try {
    const res = await fetch(wavespeedAPIEndpoint, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${WAVESPEED_API_KEY}` },
      body: JSON.stringify(requestBody) 
    });
    
    if (!res.ok) {
        const errorData = await res.json();
        const errorMessage = errorData.detail || errorData.error || `HTTP Error ${res.status}`;
        throw new Error(errorMessage);
    }
    
    const initialData = await res.json();
    const pollUrl = initialData.data.urls.get;

    if (!pollUrl) {
        throw new Error("Tidak menemukan URL untuk polling di dalam respons server.");
    }
    
    pollForResult(pollUrl);

  } catch (err) {
    const friendlyMessage = `Gagal memulai proses generate.\n\nAlasan: ${err.message}`;
    alert(friendlyMessage);
    console.error("Error dari Wavespeed AI:", err);
    fotoOutput.innerHTML = `<p class="error">${friendlyMessage}</p>`;
    fotoGenerateBtn.disabled = false;
  }
});

fotoDownloadBtn.addEventListener('click', () => {
  if (fotoGeneratedImageUrl) downloadFile(fotoGeneratedImageUrl, 'generated-image.jpg');
});