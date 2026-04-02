import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import './App.css'

const GENRES = ['Drama', 'Comedy', 'Thriller', 'Sci-Fi', 'Romance', 'Horror']
const TONES = ['Dark', 'Light', 'Neutral']
const SCENE_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1)
const STORAGE_KEY = 'ai-scriptify-history'

const initialForm = {
  idea: '',
  genre: 'Drama',
  tone: 'Neutral',
  scenes: 3,
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))
}

function buildPrompt({ idea, genre, tone, scenes }) {
  return `Write a professional short screenplay based on the following details.

Story idea: ${idea}
Genre: ${genre}
Tone: ${tone}
Number of scenes: ${scenes}

Requirements:
- Use standard screenplay formatting cues.
- Start with FADE IN:
- Include scene headings, action lines, character names, dialogue, and transitions when appropriate.
- Keep the script cinematic, emotionally engaging, and easy to read.
- Write exactly ${scenes} scenes.
- End with FADE OUT.
- Return only the screenplay text with no explanations or markdown.`
}

function parseScenes(script) {
  if (!script) return [];
  const lines = script.split('\n');
  const scenes = [];
  let currentScene = { title: '', text: '', id: crypto.randomUUID() };
  
  for (const line of lines) {
    if (line.trim().startsWith('INT.') || line.trim().startsWith('EXT.') || line.trim().startsWith('SCENE')) {
      if (currentScene.title || currentScene.text) {
        scenes.push(currentScene);
      }
      currentScene = { title: line.trim(), text: '', id: crypto.randomUUID() };
    } else {
      currentScene.text += line + '\n';
    }
  }
  if (currentScene.title || currentScene.text) {
    scenes.push(currentScene);
  }
  return scenes;
}

function inferSceneKeywords(scene) {
  const text = `${scene.title || ''} ${scene.text || ''}`.toLowerCase()

  return {
    text,
    isInterior: text.includes('int.'),
    isExterior: text.includes('ext.'),
    isNight: text.includes('night') || text.includes('midnight') || text.includes('moon') || text.includes('dark'),
    isDay: text.includes('day') || text.includes('sunrise') || text.includes('morning') || text.includes('afternoon'),
    isRainy: text.includes('rain') || text.includes('storm') || text.includes('thunder') || text.includes('wet'),
    isUrban: text.includes('city') || text.includes('street') || text.includes('alley') || text.includes('neon') || text.includes('downtown'),
    isNature: text.includes('forest') || text.includes('mountain') || text.includes('beach') || text.includes('river') || text.includes('field'),
    isSciFi: text.includes('future') || text.includes('robot') || text.includes('cyber') || text.includes('space') || text.includes('alien') || text.includes('hologram'),
    isRomantic: text.includes('love') || text.includes('kiss') || text.includes('embrace') || text.includes('tender'),
    isTense: text.includes('gun') || text.includes('knife') || text.includes('run') || text.includes('escape') || text.includes('fear') || text.includes('murder'),
    isDialogueHeavy: text.includes('says') || text.includes('asks') || text.includes('whispers') || text.includes('dialogue') || text.includes('replies'),
  }
}

function buildSceneSuggestions(scene, tone, genre) {
  const keywords = inferSceneKeywords(scene)
  const title = scene.title || 'Scene'

  const location = keywords.isExterior
    ? keywords.isUrban
      ? keywords.isNight
        ? 'Exterior city location with visible depth, practical lights, and layered street activity'
        : 'Exterior urban location with strong foreground, midground, and background separation'
      : keywords.isNature
        ? 'Exterior natural location with clear horizon lines and environmental texture'
        : 'Exterior location with depth, movement in the background, and space for wide framing'
    : keywords.isSciFi
      ? 'Interior futuristic set with glowing practicals, reflective surfaces, and layered screens'
      : keywords.isRomantic
        ? 'Interior intimate location with warm practical lighting and soft decor details'
        : 'Interior controlled location with strong production design details and visual depth'

  const background = keywords.isRainy
    ? 'Use rain reflections, drifting mist, and moving practical light sources in the background'
    : keywords.isNight
      ? 'Use low-key lighting, practical lamps, silhouettes, and distant light texture in the background'
      : keywords.isDay
        ? 'Use natural daylight, soft atmospheric depth, and subtle environmental movement in the background'
      : keywords.isSciFi
        ? 'Use holographic panels, moving light strips, and layered futuristic props in the background'
        : keywords.isNature
          ? 'Use trees, sky depth, wind movement, and textured terrain in the background'
          : 'Use layered production design, foreground objects, and ambient motion in the background'

  const cameraAngles = [
    keywords.isTense
      ? `Open ${title} with a wide establishing shot, then switch to a low-angle tracking shot to raise tension`
      : `Open ${title} with a wide establishing shot to define geography and tone`,
    keywords.isDialogueHeavy
      ? 'Use over-the-shoulder coverage and alternating medium close-ups during dialogue beats'
      : 'Use a medium profile shot to hold character movement and blocking clearly',
    keywords.isSciFi
      ? 'Add a slow orbit or Dutch-tilted insert for futuristic reveals and tech moments'
      : keywords.isRomantic
        ? 'Use soft eye-level close-ups to highlight emotional reactions'
        : 'Add a close-up insert for the key prop, expression, or turning-point detail',
  ]

  const zoomSuggestions = [
    keywords.isDialogueHeavy
      ? 'Start on a medium two-shot and apply a slow push-in during the most important line'
      : 'Begin wide, then use a slow zoom-in as the scene reveals its emotional focus',
    keywords.isTense
      ? 'Use a fast punch-in on the reveal, threat, or sudden realization'
      : 'Use a gentle punch-in only on the strongest reaction beat',
    tone === 'Light' || genre === 'Comedy'
      ? 'Favor lighter zoom pacing and avoid aggressive crash zooms unless it supports a joke'
      : 'End with a tighter frame to intensify the final beat before cutting away',
  ]

  return {
    location,
    background,
    cameraAngles,
    zoomSuggestions,
  }
}

function downloadScriptPdf(title, script) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  })

  const margin = 48
  const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2
  const pageHeight = pdf.internal.pageSize.getHeight()

  pdf.setFillColor(10, 10, 10)
  pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pageHeight, 'F')
  pdf.setTextColor(240, 192, 64)
  pdf.setFont('courier', 'bold')
  pdf.setFontSize(18)
  pdf.text(title, margin, 52)

  pdf.setDrawColor(240, 192, 64)
  pdf.line(margin, 64, pdf.internal.pageSize.getWidth() - margin, 64)

  pdf.setTextColor(248, 244, 230)
  pdf.setFont('courier', 'normal')
  pdf.setFontSize(11)

  const lines = pdf.splitTextToSize(script, pageWidth)
  let y = 88

  lines.forEach((line) => {
    if (y > pageHeight - margin) {
      pdf.addPage()
      pdf.setFillColor(10, 10, 10)
      pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pageHeight, 'F')
      pdf.setTextColor(248, 244, 230)
      pdf.setFont('courier', 'normal')
      pdf.setFontSize(11)
      y = margin
    }

    pdf.text(line, margin, y)
    y += 16
  })

  pdf.save(`${title.toLowerCase().replace(/[^a-z0-9]+/gi, '-') || 'ai-scriptify-script'}.pdf`)
}

const BGM_EVENT_NAME = 'ai-scriptify-bgm-active'
let activeBgmSession = null

function stopActiveBgm() {
  if (!activeBgmSession) return
  const stop = activeBgmSession.stop
  activeBgmSession = null
  window.dispatchEvent(new CustomEvent(BGM_EVENT_NAME, { detail: { token: null } }))
  stop()
}

function pickBgmProfile({ text, tone, genre }) {
  const lower = (text || '').toLowerCase()
  const hasAny = (terms) => terms.some((term) => lower.includes(term))

  const horrorTerms = ['blood', 'scream', 'ghost', 'haunt', 'demon', 'curse', 'terror', 'knife', 'murder', 'grave', 'dark']
  const thrillerTerms = ['chase', 'escape', 'gun', 'knife', 'hostage', 'threat', 'murder', 'mystery', 'secret', 'surveil', 'danger']
  const romanceTerms = ['love', 'kiss', 'heart', 'tender', 'soft', 'embrace', 'warm', 'promise']
  const comedyTerms = ['laugh', 'joke', 'funny', 'awkward', 'silly', 'oops', 'prank']
  const scifiTerms = ['space', 'alien', 'cyber', 'robot', 'ai', 'neon', 'quantum', 'hologram', 'starship', 'futur']

  const inferredHorror = genre === 'Horror' || hasAny(horrorTerms)
  const inferredThriller = genre === 'Thriller' || hasAny(thrillerTerms)
  const inferredComedy = genre === 'Comedy' || hasAny(comedyTerms)
  const inferredRomance = genre === 'Romance' || hasAny(romanceTerms)
  const inferredSciFi = genre === 'Sci-Fi' || hasAny(scifiTerms)

  const darkPreference = tone === 'Dark' || inferredHorror || inferredThriller
  const lightPreference = tone === 'Light' || inferredComedy || inferredRomance

  const tempoBpm = inferredComedy ? 128 : inferredThriller ? 108 : inferredHorror ? 86 : inferredRomance ? 96 : inferredSciFi ? 112 : darkPreference ? 92 : 104
  const brightnessHz = inferredHorror ? 900 : inferredThriller ? 1200 : inferredSciFi ? 2400 : inferredRomance ? 2600 : inferredComedy ? 3200 : darkPreference ? 1400 : 2200
  const noiseAmount = inferredHorror ? 0.1 : inferredThriller ? 0.06 : 0

  const mode = inferredSciFi ? 'lydian' : darkPreference ? 'minor' : lightPreference ? 'major' : 'minor'
  const baseMidi = inferredHorror ? 45 : inferredThriller ? 48 : inferredRomance ? 55 : inferredComedy ? 57 : inferredSciFi ? 52 : 50

  return { tempoBpm, brightnessHz, noiseAmount, mode, baseMidi }
}

function midiToFrequency(midiNote) {
  return 440 * Math.pow(2, (midiNote - 69) / 12)
}

function startGeneratedBgm({ text, tone, genre, token }) {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext
  if (!AudioContextCtor) {
    throw new Error('Web Audio is not supported in this browser.')
  }

  stopActiveBgm()

  const profile = pickBgmProfile({ text, tone, genre })
  const ctx = new AudioContextCtor()

  const masterGain = ctx.createGain()
  masterGain.gain.value = 0.0001

  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -20
  compressor.knee.value = 24
  compressor.ratio.value = 6
  compressor.attack.value = 0.01
  compressor.release.value = 0.18

  const lowpass = ctx.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = profile.brightnessHz
  lowpass.Q.value = 0.6

  lowpass.connect(compressor)
  compressor.connect(masterGain)
  masterGain.connect(ctx.destination)

  const stopFns = []
  const intervalIds = []

  const padGain = ctx.createGain()
  padGain.gain.value = 0.22
  padGain.connect(lowpass)

  const padOscillators = Array.from({ length: 3 }, (_, index) => {
    const osc = ctx.createOscillator()
    osc.type = index === 0 ? 'sawtooth' : 'triangle'
    osc.detune.value = index === 1 ? -9 : index === 2 ? 7 : 0

    const gain = ctx.createGain()
    gain.gain.value = 0.26
    osc.connect(gain)
    gain.connect(padGain)
    return { osc, gain }
  })

  const scaleSteps = profile.mode === 'lydian'
    ? [0, 2, 4, 6, 7, 9, 11]
    : profile.mode === 'major'
      ? [0, 2, 4, 7, 9]
      : [0, 3, 5, 7, 10]

  const progression = profile.mode === 'major'
    ? [0, 7, 9, 4]
    : profile.mode === 'lydian'
      ? [0, 6, 7, 2]
      : [0, 8, 3, 10]

  const chordIntervals = profile.mode === 'major'
    ? [0, 4, 7]
    : profile.mode === 'lydian'
      ? [0, 4, 6]
      : [0, 3, 7]

  const beatSeconds = 60 / profile.tempoBpm
  const barSeconds = beatSeconds * 4

  let chordIndex = 0
  const applyChord = (time) => {
    const root = profile.baseMidi + progression[chordIndex % progression.length]
    const chordNotes = chordIntervals.map((interval) => root + interval)

    padOscillators.forEach((entry, oscillatorIndex) => {
      const targetMidi = chordNotes[oscillatorIndex % chordNotes.length] + (oscillatorIndex === 2 ? 12 : 0)
      const targetFrequency = midiToFrequency(targetMidi)
      entry.osc.frequency.cancelScheduledValues(time)
      entry.osc.frequency.setValueAtTime(entry.osc.frequency.value || targetFrequency, time)
      entry.osc.frequency.linearRampToValueAtTime(targetFrequency, time + 0.08)
    })
    chordIndex += 1
  }

  const now = ctx.currentTime
  applyChord(now + 0.02)
  padOscillators.forEach(({ osc }) => osc.start())
  stopFns.push(() => padOscillators.forEach(({ osc }) => osc.stop()))

  const chordIntervalId = window.setInterval(() => {
    applyChord(ctx.currentTime + 0.02)
  }, Math.max(400, Math.round(barSeconds * 1000)))
  intervalIds.push(chordIntervalId)

  const leadGain = ctx.createGain()
  leadGain.gain.value = 0.16
  leadGain.connect(lowpass)

  let arpStep = 0
  const arpeggioIntervalId = window.setInterval(() => {
    const time = ctx.currentTime + 0.02
    const root = profile.baseMidi + progression[(chordIndex - 1 + progression.length) % progression.length]
    const note = root + scaleSteps[arpStep % scaleSteps.length] + (arpStep % 2 === 0 ? 12 : 0)
    const frequency = midiToFrequency(note)

    const osc = ctx.createOscillator()
    osc.type = profile.mode === 'major' ? 'sine' : 'triangle'
    osc.frequency.value = frequency

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.linearRampToValueAtTime(0.18, time + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + beatSeconds * 0.75)

    osc.connect(gain)
    gain.connect(leadGain)
    osc.start(time)
    osc.stop(time + beatSeconds * 0.8)
    arpStep += 1
  }, Math.max(140, Math.round((beatSeconds / 2) * 1000)))
  intervalIds.push(arpeggioIntervalId)

  if (profile.noiseAmount > 0) {
    const bufferDurationSeconds = 2
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * bufferDurationSeconds), ctx.sampleRate)
    const channel = buffer.getChannelData(0)
    for (let i = 0; i < channel.length; i += 1) {
      channel[i] = (Math.random() * 2 - 1) * 0.4
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const bandpass = ctx.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.value = 420
    bandpass.Q.value = 0.8

    const noiseGain = ctx.createGain()
    noiseGain.gain.value = profile.noiseAmount

    source.connect(bandpass)
    bandpass.connect(noiseGain)
    noiseGain.connect(lowpass)
    source.start()
    stopFns.push(() => source.stop())
  }

  masterGain.gain.setValueAtTime(0.0001, now)
  masterGain.gain.exponentialRampToValueAtTime(0.22, now + 0.18)

  const stop = () => {
    intervalIds.forEach((id) => window.clearInterval(id))
    const stopTime = ctx.currentTime + 0.02
    masterGain.gain.cancelScheduledValues(stopTime)
    masterGain.gain.setValueAtTime(Math.max(0.0001, masterGain.gain.value), stopTime)
    masterGain.gain.exponentialRampToValueAtTime(0.0001, stopTime + 0.2)

    window.setTimeout(() => {
      stopFns.forEach((fn) => {
        try {
          fn()
        } catch {
          return
        }
      })
      ctx.close().catch(() => undefined)
    }, 350)
  }

  activeBgmSession = { token, stop }
  window.dispatchEvent(new CustomEvent(BGM_EVENT_NAME, { detail: { token } }))

  return stop
}

function BgmButton({ text, tone, genre, showError = true }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState('')
  const tokenRef = useRef(null)

  useEffect(() => {
    const handler = (event) => {
      const token = event?.detail?.token || null
      if (!token || token !== tokenRef.current) {
        setIsPlaying(false)
      }
    }

    window.addEventListener(BGM_EVENT_NAME, handler)
    return () => window.removeEventListener(BGM_EVENT_NAME, handler)
  }, [])

  useEffect(() => {
    return () => {
      if (activeBgmSession?.token && activeBgmSession.token === tokenRef.current) {
        stopActiveBgm()
      }
    }
  }, [])

  const handleToggle = async () => {
    if (isPlaying) {
      stopActiveBgm()
      tokenRef.current = null
      setIsPlaying(false)
      return
    }

    setError('')
    try {
      const token = crypto.randomUUID()
      tokenRef.current = token
      startGeneratedBgm({ text, tone, genre, token })
      setIsPlaying(true)
    } catch (err) {
      setError(err.message || 'Unable to play background music.')
      setIsPlaying(false)
      tokenRef.current = null
    }
  }

  return (
    <>
      <button type="button" className="secondary-button" onClick={handleToggle}>
        {isPlaying ? 'Stop BGM' : 'Play BGM'}
      </button>
      {showError && error ? <p className="status-message error-message">{error}</p> : null}
    </>
  )
}

function SceneMedia({ scene, index, tone, genre }) {
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageLoading, setImageLoading] = useState(true)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestions = useMemo(() => buildSceneSuggestions(scene, tone, genre), [scene, tone, genre])

  useEffect(() => {
    let isMounted = true;
    const fetchImage = async () => {
      setImageLoading(true);
      try {
        const pixazoKey = import.meta.env.VITE_PIXAZO_API_KEY;
        const promptText = `Cinematic still frame, ${scene.title || 'Scene'}, highly detailed, dramatic lighting, 8k resolution, photorealistic. ${scene.text.substring(0, 150).replace(/\n/g, ' ')}`;
        if (!pixazoKey) {
          throw new Error('Missing Pixazo API key');
        }

        const response = await fetch('https://gateway.pixazo.ai/flux-1-schnell/v1/getData', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': pixazoKey
          },
          body: JSON.stringify({
            prompt: promptText
          })
        });

        if (!response.ok) {
          throw new Error('Image generation failed');
        }

        const data = await response.json();
        
        let returnedImage = '';
        if (data.output) {
          returnedImage = data.output;
        } else if (data.image_url) {
          returnedImage = data.image_url;
        } else if (data.data && data.data.length > 0 && data.data[0].url) {
          returnedImage = data.data[0].url;
        } else if (data.images && data.images.length > 0) {
          returnedImage = data.images[0].startsWith('http') ? data.images[0] : `data:image/png;base64,${data.images[0]}`;
        }

        if (isMounted && returnedImage) {
          setImageUrl(returnedImage);
        }
      } catch (err) {
        console.error('Pixazo API error:', err);
        // Fallback to Pollinations just to allow UI graceful degradation if API call fails
        if (isMounted) {
          const fallbackPromptText = `Cinematic still frame, ${scene.title || 'Scene'}. ${scene.text.substring(0, 50).replace(/\n/g, ' ')}`;
          setImageUrl(`https://image.pollinations.ai/prompt/${encodeURIComponent(fallbackPromptText)}`);
        }
      } finally {
        if (isMounted) setImageLoading(false);
      }
    };
    fetchImage();

    return () => { isMounted = false; };
  }, [scene.title, scene.text]);

  const handleGenerateAudio = async () => {
    if (isPlaying) {
      window.speechSynthesis.cancel()
      setIsPlaying(false)
      return
    }

    setAudioLoading(true)
    setAudioError('')
    
    try {
      const textToRead = (scene.title + '\n' + scene.text)
      
      if (!('speechSynthesis' in window)) {
        throw new Error('Text-to-speech is not supported in this browser.')
      }

      window.speechSynthesis.cancel() // Stop any currently playing audio

      const utterance = new SpeechSynthesisUtterance(textToRead)
      
      // Try to find a good English voice
      const voices = window.speechSynthesis.getVoices()
      const englishVoice = voices.find(v => v.lang.startsWith('en-') && (v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'))) || voices.find(v => v.lang.startsWith('en-'))
      
      if (englishVoice) {
        utterance.voice = englishVoice
      }

      utterance.rate = 0.95
      utterance.pitch = 1.0

      utterance.onstart = () => setIsPlaying(true)
      utterance.onend = () => setIsPlaying(false)
      utterance.onerror = (e) => {
        setIsPlaying(false)
        if (e.error !== 'canceled') {
          setAudioError('Failed to play audio.')
        }
      }

      window.speechSynthesis.speak(utterance)
    } catch (err) {
      setAudioError(err.message || 'Audio generation failed.')
      setIsPlaying(false)
    } finally {
      setAudioLoading(false)
    }
  }

  return (
    <div className="scene-media-card">
      <div className="scene-media-image-container">
        {imageLoading ? (
          <div className="image-loading-placeholder" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '200px', backgroundColor: '#1a1a1a', color: '#888', borderRadius: '12px' }}>
            <span className="spinner" style={{ marginRight: '8px' }}></span> Generating Image...
          </div>
        ) : (
          <img 
            src={imageUrl} 
            alt={`Scene ${index + 1}`} 
            className="scene-media-image" 
            loading="lazy" 
          />
        )}
      </div>
      <div className="scene-media-content">
        <div className="scene-media-audio-actions">
          <button 
            type="button" 
            className="secondary-button" 
            onClick={handleGenerateAudio}
            disabled={audioLoading}
          >
            {isPlaying ? 'Stop Audio' : 'Play Scene Audio (Browser TTS)'}
          </button>
          <BgmButton text={`${scene.title}\n${scene.text}`} tone={tone} genre={genre} />
          <button
            type="button"
            className="secondary-button"
            onClick={() => setShowSuggestions((current) => !current)}
          >
            {showSuggestions ? 'Hide Suggestions' : 'Show Suggestions'}
          </button>
          {audioError && <p className="status-message error-message">{audioError}</p>}
        </div>
        {showSuggestions ? (
          <section className="scene-suggestions-panel">
            <h3>Shot Suggestions</h3>
            <div className="scene-suggestions-grid">
              <article className="scene-suggestion-card">
                <span>Background</span>
                <p>{suggestions.background}</p>
              </article>
              <article className="scene-suggestion-card">
                <span>Location</span>
                <p>{suggestions.location}</p>
              </article>
              <article className="scene-suggestion-card">
                <span>Camera Angles</span>
                <p>{suggestions.cameraAngles.join(' ')}</p>
              </article>
              <article className="scene-suggestion-card">
                <span>Zoom</span>
                <p>{suggestions.zoomSuggestions.join(' ')}</p>
              </article>
            </div>
          </section>
        ) : null}
        <pre className="scene-media-text">
          {scene.title && <strong>{scene.title}{'\n'}</strong>}
          {scene.text}
        </pre>
      </div>
    </div>
  )
}

function GeneratorPage({
  form,
  script,
  loading,
  error,
  copied,
  onFormChange,
  onGenerate,
  onCopy,
  onDownload,
}) {
  const [viewMode, setViewMode] = useState('text') // 'text' | 'media'
  const hasScript = Boolean(script)
  const scenes = useMemo(() => parseScenes(script), [script])

  return (
    <div className="page-shell">
      <section className="hero-panel">
        <div className="eyebrow">AI-Powered Screenplay Studio</div>
        <h1>AI Scriptify</h1>
        <p className="hero-copy">
          Turn a raw story spark into a polished screenplay with cinematic structure,
          dialogue, and scene-by-scene pacing.
        </p>
        <div className="hero-pills">
          <span>OpenRouter + Llama 3.3 70B</span>
          <span>Local script history</span>
          <span>PDF export</span>
        </div>
      </section>

      <section className="workspace-grid">
        <form className="control-panel" onSubmit={onGenerate}>
          <div className="section-heading">
            <h2>Story Setup</h2>
            <p>Shape the world, mood, and pacing before the first scene begins.</p>
          </div>

          <label className="field">
            <span>Story Idea</span>
            <textarea
              name="idea"
              value={form.idea}
              onChange={onFormChange}
              placeholder="A washed-up detective receives calls from his future self warning him about a murder at midnight."
              rows={7}
              required
            />
          </label>

          <div className="field-grid">
            <label className="field">
              <span>Genre</span>
              <select name="genre" value={form.genre} onChange={onFormChange}>
                {GENRES.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Tone</span>
              <select name="tone" value={form.tone} onChange={onFormChange}>
                {TONES.map((tone) => (
                  <option key={tone} value={tone}>
                    {tone}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Scenes</span>
              <select name="scenes" value={form.scenes} onChange={onFormChange}>
                {SCENE_OPTIONS.map((sceneCount) => (
                  <option key={sceneCount} value={sceneCount}>
                    {sceneCount}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true"></span>
                Generating screenplay...
              </>
            ) : (
              'Generate Script'
            )}
          </button>

          {error ? <p className="status-message error-message">{error}</p> : null}
        </form>

        <section className="output-panel">
          <div className="output-header">
            <div>
              <h2>Screenplay Output</h2>
              <p>Formatted for a dramatic, readable screenplay presentation.</p>
            </div>

            <div className="action-group">
              {hasScript && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setViewMode(v => v === 'text' ? 'media' : 'text')}
                >
                  {viewMode === 'text' ? 'View Media Storyboard' : 'View Text Script'}
                </button>
              )}
              {hasScript ? <BgmButton text={script} tone={form.tone} genre={form.genre} showError={false} /> : null}
              <button
                className="secondary-button"
                type="button"
                onClick={onCopy}
                disabled={!hasScript}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={onDownload}
                disabled={!hasScript}
              >
                Download PDF
              </button>
            </div>
          </div>

          <div className={`screenplay-frame ${hasScript ? 'ready' : 'empty'}`}>
            {hasScript ? (
              viewMode === 'text' ? (
                <pre>{script}</pre>
              ) : (
                <div className="media-storyboard">
                  {scenes.map((scene, index) => (
                    <SceneMedia key={scene.id} scene={scene} index={index} tone={form.tone} genre={form.genre} />
                  ))}
                </div>
              )
            ) : (
              <div className="empty-state">
                <span className="empty-label">FADE IN:</span>
                <p>Your generated screenplay appears here with scene headings, action lines, and dialogue.</p>
              </div>
            )}
          </div>
        </section>
      </section>
    </div>
  )
}

function HistoryPage({ history, onReuse }) {
  const navigate = useNavigate()

  const handleReuse = (entry) => {
    onReuse(entry)
    navigate('/')
  }

  return (
    <div className="page-shell">
      <section className="history-panel">
        <div className="section-heading history-header">
          <div>
            <div className="eyebrow">Saved Scripts</div>
            <h1>History</h1>
            <p>Every generated screenplay is stored locally in your browser for quick revisit and reuse.</p>
          </div>
          <Link className="secondary-button nav-button" to="/">
            Back to Generator
          </Link>
        </div>

        {history.length ? (
          <div className="history-list">
            {history.map((entry) => (
              <article className="history-card" key={entry.id}>
                <div className="history-card-top">
                  <div>
                    <h2>{entry.title}</h2>
                    <p>{formatDate(entry.createdAt)}</p>
                  </div>
                  <div className="history-meta">
                    <span>{entry.genre}</span>
                    <span>{entry.tone}</span>
                    <span>{entry.scenes} scenes</span>
                  </div>
                </div>

                <p className="history-idea">{entry.idea}</p>
                <pre className="history-preview">{entry.script}</pre>

                <div className="action-group">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => handleReuse(entry)}
                  >
                    Reuse
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => downloadScriptPdf(entry.title, entry.script)}
                  >
                    Download PDF
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-history">
            <span className="empty-label">NO SAVED SCRIPTS</span>
            <p>Generate your first screenplay and it appears here automatically.</p>
          </div>
        )}
      </section>
    </div>
  )
}

function App() {
  const [form, setForm] = useState(initialForm)
  const [script, setScript] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => {
    const storedHistory = localStorage.getItem(STORAGE_KEY)

    if (!storedHistory) {
      return
    }

    try {
      setHistory(JSON.parse(storedHistory))
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    if (!history.length) {
      return
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  }, [history])

  const currentTitle = useMemo(() => {
    const trimmedIdea = form.idea.trim()

    if (!trimmedIdea) {
      return 'AI Scriptify Screenplay'
    }

    return trimmedIdea.split(/[.!?]/)[0].slice(0, 60)
  }, [form.idea])

  const handleFormChange = (event) => {
    const { name, value } = event.target

    setForm((currentForm) => ({
      ...currentForm,
      [name]: name === 'scenes' ? Number(value) : value,
    }))
  }

  const handleGenerate = async (event) => {
    event.preventDefault()
    setCopied(false)
    setError('')

    if (!import.meta.env.VITE_OPENROUTER_API_KEY) {
      setError('Missing VITE_OPENROUTER_API_KEY. Add it to your environment file and restart Vite.')
      return
    }

    setLoading(true)

    try {
      const prompt = buildPrompt(form)
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
          'HTTP-Referer': window.location.href, // Optional, for including your app on openrouter.ai rankings.
          'X-Title': 'AI Scriptify', // Optional. Shows in rankings on openrouter.ai.
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct', // Equivalent Llama 3.3 70B model on OpenRouter
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.9,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenRouter request failed with status ${response.status}.`)
      }

      const data = await response.json()
      const generatedScript = data?.choices?.[0]?.message?.content?.trim()

      if (!generatedScript) {
        throw new Error('The model returned an empty response.')
      }

      const entry = {
        id: crypto.randomUUID(),
        title: currentTitle,
        ...form,
        script: generatedScript,
        createdAt: Date.now(),
      }

      setScript(generatedScript)
      setHistory((currentHistory) => [entry, ...currentHistory].slice(0, 12))
    } catch (requestError) {
      setError(requestError.message || 'Unable to generate a screenplay right now.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!script) {
      return
    }

    try {
      await navigator.clipboard.writeText(script)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copy failed. Your browser may have blocked clipboard access.')
    }
  }

  const handleDownload = () => {
    if (!script) {
      return
    }

    downloadScriptPdf(currentTitle, script)
  }

  const handleReuse = (entry) => {
    setForm({
      idea: entry.idea,
      genre: entry.genre,
      tone: entry.tone,
      scenes: entry.scenes,
    })
    setScript(entry.script)
    setCopied(false)
    setError('')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          AI Scriptify
        </Link>
        <nav className="nav-links">
          <Link className="nav-link" to="/">
            Generator
          </Link>
          <Link className="nav-link" to="/history">
            History
          </Link>
        </nav>
      </header>

      <Routes>
        <Route
          path="/"
          element={
            <GeneratorPage
              form={form}
              script={script}
              loading={loading}
              error={error}
              copied={copied}
              onFormChange={handleFormChange}
              onGenerate={handleGenerate}
              onCopy={handleCopy}
              onDownload={handleDownload}
            />
          }
        />
        <Route path="/history" element={<HistoryPage history={history} onReuse={handleReuse} />} />
      </Routes>
    </div>
  )
}

export default App
