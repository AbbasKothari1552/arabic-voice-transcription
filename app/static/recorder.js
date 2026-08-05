// Audio Recorder & WAV encoder logic for STT Prototype
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const tabRecord = document.getElementById('tabRecord');
  const tabUpload = document.getElementById('tabUpload');
  const contentRecord = document.getElementById('contentRecord');
  const contentUpload = document.getElementById('contentUpload');

  const btnRecord = document.getElementById('btnRecord');
  const btnRecordText = document.getElementById('btnRecordText');
  const btnStop = document.getElementById('btnStop');
  const timerDisplay = document.getElementById('timerDisplay');
  const waveformCanvas = document.getElementById('waveformCanvas');
  const canvasCtx = waveformCanvas.getContext('2d');

  const previewBox = document.getElementById('previewBox');
  const audioPlayback = document.getElementById('audioPlayback');
  const downloadWavBtn = document.getElementById('downloadWavBtn');

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const fileInfoBox = document.getElementById('fileInfoBox');
  const fileName = document.getElementById('fileName');
  const btnClearFile = document.getElementById('btnClearFile');

  const btnTranscribe = document.getElementById('btnTranscribe');
  const btnCopy = document.getElementById('btnCopy');
  const placeholderState = document.getElementById('placeholderState');
  const loadingState = document.getElementById('loadingState');
  const transcriptDisplay = document.getElementById('transcriptDisplay');
  const resultFooter = document.getElementById('resultFooter');
  const filePathInfo = document.getElementById('filePathInfo');
  const inferenceTimer = document.getElementById('inferenceTimer');

  // State Variables
  let activeMode = 'record'; // 'record' or 'upload'
  let audioContext = null;
  let mediaStream = null;
  let audioInput = null;
  let scriptProcessor = null;

  let isRecording = false;
  let leftChannelData = [];
  let recordingLength = 0;
  let sampleRate = 44100;
  let timerInterval = null;
  let secondsElapsed = 0;

  let recordedWavBlob = null;
  let uploadedFile = null;

  // Draw initial canvas line
  drawEmptyWaveform();

  // Tab switching
  tabRecord.addEventListener('click', () => switchTab('record'));
  tabUpload.addEventListener('click', () => switchTab('upload'));

  function switchTab(mode) {
    activeMode = mode;
    if (mode === 'record') {
      tabRecord.classList.add('active');
      tabUpload.classList.remove('active');
      contentRecord.classList.remove('hidden');
      contentUpload.classList.add('hidden');
      btnTranscribe.disabled = !recordedWavBlob;
    } else {
      tabUpload.classList.add('active');
      tabRecord.classList.remove('active');
      contentUpload.classList.remove('hidden');
      contentRecord.classList.add('hidden');
      btnTranscribe.disabled = !uploadedFile;
    }
  }

  // Timer helper
  function startTimer() {
    secondsElapsed = 0;
    timerDisplay.textContent = '00:00';
    timerInterval = setInterval(() => {
      secondsElapsed++;
      const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
      const secs = String(secondsElapsed % 60).padStart(2, '0');
      timerDisplay.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
  }

  // Audio Recording (PCM WAV AudioContext)
  btnRecord.addEventListener('click', async () => {
    if (isRecording) return;

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      sampleRate = audioContext.sampleRate;

      audioInput = audioContext.createMediaStreamSource(mediaStream);
      scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

      leftChannelData = [];
      recordingLength = 0;

      scriptProcessor.onaudioprocess = (e) => {
        if (!isRecording) return;
        const input = e.inputBuffer.getChannelData(0);
        leftChannelData.push(new Float32Array(input));
        recordingLength += input.length;
        drawWaveform(input);
      };

      audioInput.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      isRecording = true;
      btnRecord.classList.add('recording-pulse');
      btnRecord.disabled = true;
      btnRecordText.textContent = 'Recording...';
      btnStop.disabled = false;
      btnTranscribe.disabled = true;
      previewBox.classList.add('hidden');

      startTimer();
    } catch (err) {
      alert('Microphone access failed: ' + err.message);
    }
  });

  btnStop.addEventListener('click', () => {
    if (!isRecording) return;
    isRecording = false;
    stopTimer();

    btnRecord.classList.remove('recording-pulse');
    btnRecord.disabled = false;
    btnRecordText.textContent = 'Record Again';
    btnStop.disabled = true;

    // Disconnect nodes & stop tracks
    if (scriptProcessor) scriptProcessor.disconnect();
    if (audioInput) audioInput.disconnect();
    if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());

    // Encode PCM to WAV
    recordedWavBlob = exportWAV(leftChannelData, recordingLength, sampleRate);
    const audioUrl = URL.createObjectURL(recordedWavBlob);
    
    audioPlayback.src = audioUrl;
    downloadWavBtn.href = audioUrl;
    downloadWavBtn.download = `recording_${Date.now()}.wav`;
    previewBox.classList.remove('hidden');

    btnTranscribe.disabled = false;
    drawEmptyWaveform();
  });

  // Waveform visualization
  function drawEmptyWaveform() {
    canvasCtx.fillStyle = '#0d1322';
    canvasCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, waveformCanvas.height / 2);
    canvasCtx.lineTo(waveformCanvas.width, waveformCanvas.height / 2);
    canvasCtx.stroke();
  }

  function drawWaveform(data) {
    canvasCtx.fillStyle = '#0d1322';
    canvasCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = '#6366f1';
    canvasCtx.beginPath();

    const sliceWidth = waveformCanvas.width * 1.0 / data.length;
    let x = 0;

    for (let i = 0; i < data.length; i += 10) {
      const v = data[i];
      const y = (v + 1) * (waveformCanvas.height / 2);

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }
      x += sliceWidth * 10;
    }
    canvasCtx.stroke();
  }

  // Convert raw Float32 array to WAV Blob
  function exportWAV(buffers, totalLength, sampleRate) {
    const flattened = new Float32Array(totalLength);
    let offset = 0;
    for (let i = 0; i < buffers.length; i++) {
      flattened.set(buffers[i], offset);
      offset += buffers[i].length;
    }

    const buffer = new ArrayBuffer(44 + flattened.length * 2);
    const view = new DataView(buffer);

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* RIFF chunk length */
    view.setUint32(4, 36 + flattened.length * 2, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw PCM = 1) */
    view.setUint16(20, 1, true);
    /* channel count (1 = mono) */
    view.setUint16(22, 1, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sampleRate * 2) */
    view.setUint32(28, sampleRate * 2, true);
    /* block align */
    view.setUint16(32, 2, true);
    /* bits per sample (16 bit) */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, flattened.length * 2, true);

    // Write PCM samples
    let index = 44;
    for (let i = 0; i < flattened.length; i++) {
      let s = Math.max(-1, Math.min(1, flattened[i]));
      view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      index += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // File Upload Handlers
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  function handleFile(file) {
    uploadedFile = file;
    fileName.textContent = file.name;
    fileInfoBox.classList.remove('hidden');
    dropzone.classList.add('hidden');
    btnTranscribe.disabled = false;
  }

  btnClearFile.addEventListener('click', (e) => {
    e.stopPropagation();
    uploadedFile = null;
    fileInput.value = '';
    fileInfoBox.classList.add('hidden');
    dropzone.classList.remove('hidden');
    btnTranscribe.disabled = true;
  });

  // Send Audio File to FastAPI Server
  btnTranscribe.addEventListener('click', async () => {
    const audioBlob = activeMode === 'record' ? recordedWavBlob : uploadedFile;
    if (!audioBlob) return;

    placeholderState.classList.add('hidden');
    transcriptDisplay.classList.add('hidden');
    loadingState.classList.remove('hidden');
    btnTranscribe.disabled = true;

    let infSeconds = 0;
    const infInterval = setInterval(() => {
      infSeconds += 0.1;
      inferenceTimer.textContent = `${infSeconds.toFixed(1)}s`;
    }, 100);

    try {
      const formData = new FormData();
      const fname = activeMode === 'record' ? 'mic_recording.wav' : audioBlob.name;
      formData.append('file', audioBlob, fname);

      const response = await fetch('/transcribe-file', {
        method: 'POST',
        body: formData
      });

      clearInterval(infInterval);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Transcription failed');
      }

      const result = await response.json();

      loadingState.classList.add('hidden');
      transcriptDisplay.textContent = result.transcription || '(No speech detected)';
      transcriptDisplay.classList.remove('hidden');

      filePathInfo.textContent = `Server file saved: ${result.file_path}`;
      resultFooter.classList.remove('hidden');
      btnCopy.disabled = false;

    } catch (err) {
      clearInterval(infInterval);
      loadingState.classList.add('hidden');
      placeholderState.classList.remove('hidden');
      alert('Error during transcription: ' + err.message);
    } finally {
      btnTranscribe.disabled = false;
    }
  });

  // Page Switching Logic (Studio vs Surah Al-Hamd)
  const navStudio = document.getElementById('navStudio');
  const navSurah = document.getElementById('navSurah');
  const studioPage = document.getElementById('studioPage');
  const surahPage = document.getElementById('surahPage');

  if (navStudio && navSurah) {
    navStudio.addEventListener('click', () => {
      navStudio.classList.add('active');
      navSurah.classList.remove('active');
      studioPage.classList.remove('hidden');
      surahPage.classList.add('hidden');
    });

    navSurah.addEventListener('click', () => {
      navSurah.classList.add('active');
      navStudio.classList.remove('active');
      surahPage.classList.remove('hidden');
      studioPage.classList.add('hidden');
    });
  }

  // ==================== SURAH AL-HAMD RECITATION LOGIC ====================
  const SURAH_HAMD = [
    { id: 1, text: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ" },
    { id: 2, text: "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ" },
    { id: 3, text: "ٱلرَّحْمَٰنِ ٱلرَّحِيمِ" },
    { id: 4, text: "مَٰلِكِ يَوْمِ ٱلدِّينِ" },
    { id: 5, text: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ" },
    { id: 6, text: "ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ" },
    { id: 7, text: "صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ" }
  ];

  let selectedAyahIndex = 0;
  let isSurahRecording = false;
  let surahMediaStream = null;
  let surahAudioContext = null;
  let surahAudioInput = null;
  let surahScriptProcessor = null;
  let surahLeftChannelData = [];
  let surahRecordingLength = 0;
  let surahTimerInterval = null;
  let surahSeconds = 0;

  const ayahListContainer = document.getElementById('ayahListContainer');
  const activeAyahNum = document.getElementById('activeAyahNum');
  const activeAyahText = document.getElementById('activeAyahText');
  const btnSurahRecord = document.getElementById('btnSurahRecord');
  const btnSurahRecordText = document.getElementById('btnSurahRecordText');
  const btnSurahStop = document.getElementById('btnSurahStop');
  const surahTimer = document.getElementById('surahTimer');
  const accuracyPill = document.getElementById('accuracyPill');
  const surahPlaceholder = document.getElementById('surahPlaceholder');
  const surahLoading = document.getElementById('surahLoading');
  const surahResultDisplay = document.getElementById('surahResultDisplay');
  const formattedWordsContainer = document.getElementById('formattedWordsContainer');
  const detectedText = document.getElementById('detectedText');

  // Render Ayah list
  function renderAyahList() {
    if (!ayahListContainer) return;
    ayahListContainer.innerHTML = '';
    SURAH_HAMD.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = `ayah-item ${index === selectedAyahIndex ? 'active' : ''}`;
      el.innerHTML = `
        <div class="ayah-num">${item.id}</div>
        <div class="ayah-text-preview" dir="rtl" lang="ar">${item.text}</div>
      `;
      el.addEventListener('click', () => {
        selectedAyahIndex = index;
        updateActiveAyahDisplay();
        renderAyahList();
      });
      ayahListContainer.appendChild(el);
    });
  }

  function updateActiveAyahDisplay() {
    const item = SURAH_HAMD[selectedAyahIndex];
    if (activeAyahNum) activeAyahNum.textContent = `Ayah ${item.id}`;
    if (activeAyahText) activeAyahText.textContent = item.text;
    
    // Reset verification UI
    if (accuracyPill) accuracyPill.classList.add('hidden');
    if (surahPlaceholder) surahPlaceholder.classList.remove('hidden');
    if (surahLoading) surahLoading.classList.add('hidden');
    if (surahResultDisplay) surahResultDisplay.classList.add('hidden');
  }

  renderAyahList();

  // Record Surah Ayah
  if (btnSurahRecord) {
    btnSurahRecord.addEventListener('click', async () => {
      if (isSurahRecording) return;

      try {
        surahMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        surahAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        surahAudioInput = surahAudioContext.createMediaStreamSource(surahMediaStream);
        surahScriptProcessor = surahAudioContext.createScriptProcessor(4096, 1, 1);

        surahLeftChannelData = [];
        surahRecordingLength = 0;

        surahScriptProcessor.onaudioprocess = (e) => {
          if (!isSurahRecording) return;
          const input = e.inputBuffer.getChannelData(0);
          surahLeftChannelData.push(new Float32Array(input));
          surahRecordingLength += input.length;
        };

        surahAudioInput.connect(surahScriptProcessor);
        surahScriptProcessor.connect(surahAudioContext.destination);

        isSurahRecording = true;
        btnSurahRecord.classList.add('recording-pulse');
        btnSurahRecord.disabled = true;
        btnSurahRecordText.textContent = 'Reciting...';
        btnSurahStop.disabled = false;

        surahSeconds = 0;
        surahTimer.textContent = '00:00';
        surahTimerInterval = setInterval(() => {
          surahSeconds++;
          const mins = String(Math.floor(surahSeconds / 60)).padStart(2, '0');
          const secs = String(surahSeconds % 60).padStart(2, '0');
          surahTimer.textContent = `${mins}:${secs}`;
        }, 1000);

      } catch (err) {
        alert('Microphone error: ' + err.message);
      }
    });
  }

  if (btnSurahStop) {
    btnSurahStop.addEventListener('click', async () => {
      if (!isSurahRecording) return;
      isSurahRecording = false;
      clearInterval(surahTimerInterval);

      btnSurahRecord.classList.remove('recording-pulse');
      btnSurahRecord.disabled = false;
      btnSurahRecordText.textContent = 'Recite Selected Ayah';
      btnSurahStop.disabled = true;

      if (surahScriptProcessor) surahScriptProcessor.disconnect();
      if (surahAudioInput) surahAudioInput.disconnect();
      if (surahMediaStream) surahMediaStream.getTracks().forEach(t => t.stop());

      // Export WAV blob
      const wavBlob = exportWAV(surahLeftChannelData, surahRecordingLength, surahAudioContext.sampleRate);
      
      // UI Loading state
      surahPlaceholder.classList.add('hidden');
      surahResultDisplay.classList.add('hidden');
      surahLoading.classList.remove('hidden');

      try {
        const formData = new FormData();
        formData.append('file', wavBlob, `ayah_${selectedAyahIndex + 1}.wav`);

        const response = await fetch('/transcribe-file', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) throw new Error('Transcription failed');
        const res = await response.json();

        surahLoading.classList.add('hidden');
        verifySurahRecitation(res.transcription || '');

      } catch (err) {
        surahLoading.classList.add('hidden');
        surahPlaceholder.classList.remove('hidden');
        alert('Failed to analyze recitation: ' + err.message);
      }
    });
  }

  // Arabic Normalization Helper (Strips Tashkeel / Harakat & Normalizes Alifs)
  function normalizeArabic(text) {
    if (!text) return "";
    return text
      // Remove Arabic diacritics / Tashkeel
      .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
      // Normalize Alif variations (أ, إ, آ, ٱ -> ا)
      .replace(/[أإآٱ]/g, "ا")
      // Normalize Ya / Alif Maqsura (ى -> ي)
      .replace(/ى/g, "ي")
      // Normalize Ta Marbuta (ة -> ه)
      .replace(/ة/g, "ه")
      .trim();
  }

  // Word-by-word verification and green/red matching
  function verifySurahRecitation(transcription) {
    const targetAyahObj = SURAH_HAMD[selectedAyahIndex];
    const originalText = targetAyahObj.text;
    const targetWords = originalText.split(/\s+/);
    
    const normalizedTargetWords = targetWords.map(w => normalizeArabic(w));
    const normalizedDetectedWords = normalizeArabic(transcription).split(/\s+/).filter(w => w.length > 0);

    formattedWordsContainer.innerHTML = '';
    let correctCount = 0;

    targetWords.forEach((word, i) => {
      const normTarget = normalizedTargetWords[i];
      // Check if normTarget matches any word in detected transcription or in position
      const isMatch = normalizedDetectedWords.some(dw => dw === normTarget || dw.includes(normTarget) || normTarget.includes(dw));

      const span = document.createElement('span');
      span.textContent = word;
      
      if (isMatch) {
        span.className = 'word-correct';
        correctCount++;
      } else {
        span.className = 'word-wrong';
      }
      formattedWordsContainer.appendChild(span);
    });

    const accuracyPct = Math.round((correctCount / targetWords.length) * 100);

    accuracyPill.textContent = `${accuracyPct}% Match (${correctCount}/${targetWords.length} Words)`;
    accuracyPill.className = `accuracy-score-pill ${accuracyPct >= 70 ? 'good' : 'bad'}`;
    accuracyPill.classList.remove('hidden');

    detectedText.textContent = transcription || '(No clear speech detected)';
    surahResultDisplay.classList.remove('hidden');
  }
});

