import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import * as db from "@/lib/supabaseData";
import { type Candidato } from "@/lib/supabaseData";
import { getUsuarios, type Usuario } from "@/lib/usuarioData";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";
const logoEmpresa = "https://rmetppilvfrxosvxzhgj.supabase.co/storage/v1/object/public/message-attachments/a19408a9-2be4-432f-8241-1f3f46c871fa/1775478477701_7a3z13_LOGO.png";

function getAtendente(c: Candidato): string | null {
  const match = c.observacoes?.match(/atendente:([^|]+)/);
  return match ? match[1].trim() : null;
}

const specialtyGradients: Record<string, { bg: string; border: string; label: string }> = {
  psicolog: { bg: "linear-gradient(180deg, rgba(147,51,234,0.8) 0%, rgba(109,40,217,0.8) 100%)", border: "rgba(192,132,252,0.4)", label: "rgba(245,230,255,0.8)" },
  enfermag: { bg: "linear-gradient(180deg, rgba(16,185,129,0.8) 0%, rgba(5,150,105,0.8) 100%)", border: "rgba(110,231,183,0.4)", label: "rgba(220,255,240,0.8)" },
  medic: { bg: "linear-gradient(180deg, rgba(59,130,246,0.8) 0%, rgba(37,99,235,0.8) 100%)", border: "rgba(147,197,253,0.4)", label: "rgba(220,235,255,0.8)" },
  fono: { bg: "linear-gradient(180deg, rgba(236,72,153,0.8) 0%, rgba(219,39,119,0.8) 100%)", border: "rgba(244,114,182,0.4)", label: "rgba(255,230,240,0.8)" },
  social: { bg: "linear-gradient(180deg, rgba(245,158,11,0.8) 0%, rgba(217,119,6,0.8) 100%)", border: "rgba(253,186,116,0.4)", label: "rgba(255,245,220,0.8)" },
  seguranca: { bg: "linear-gradient(180deg, rgba(239,68,68,0.8) 0%, rgba(185,28,28,0.8) 100%)", border: "rgba(252,165,165,0.4)", label: "rgba(255,230,230,0.8)" },
};

function getSpecialtyStyle(especialidade: string) {
  const lower = (especialidade || "").toLowerCase();
  for (const key of Object.keys(specialtyGradients)) {
    if (lower.includes(key)) return specialtyGradients[key];
  }
  // Default green
  return { bg: "linear-gradient(180deg, rgba(16,185,129,0.7) 0%, rgba(5,150,105,0.7) 100%)", border: "rgba(110,231,183,0.3)", label: "rgba(220,255,240,0.8)" };
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span>
      {now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }).toUpperCase()}
      {" - "}
      {now.toLocaleDateString("pt-BR", { weekday: "long" }).toUpperCase()}
      {" — "}
      {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} HS
    </span>
  );
}

export default function PainelAtendimento() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayIndex, setDisplayIndex] = useState(0);
  const previousMapRef = useRef<Map<string, string>>(new Map());

  const fetchData = useCallback(async () => {
    const data = await db.getCandidatosDoDia();
    setCandidatos(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const refreshUsers = () => getUsuarios().then(setUsuarios);
    refreshUsers();
    // Polling removed in favor of Realtime (line 86+)
    const syncWhenVisible = () => {
      if (!document.hidden) fetchData();
    };
    window.addEventListener("usuarios-updated", refreshUsers);
    window.addEventListener("especialistas-do-dia-updated", refreshUsers);
    window.addEventListener("storage", refreshUsers);
    window.addEventListener("focus", fetchData);
    document.addEventListener("visibilitychange", syncWhenVisible);
    return () => {
      // Interval removed
      window.removeEventListener("usuarios-updated", refreshUsers);
      window.removeEventListener("especialistas-do-dia-updated", refreshUsers);
      window.removeEventListener("storage", refreshUsers);
      window.removeEventListener("focus", fetchData);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [fetchData]);

  // Realtime + forced sync fallback for all open panels.
  useEffect(() => {
    const channel = supabase
      .channel(`painel-realtime-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidatos' }, () => {
        console.log("[Painel] DB Change detected, fetching...");
        fetchData();
      })
      .on('broadcast', { event: 'novo-atendimento' }, (payload) => {
        console.log("[Painel] Broadcast received:", payload);
        fetchData();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") fetchData();
      });
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);



  // Track when each candidate first appeared as em_atendimento (or was re-called)
  // After 30s the call disappears from the panel.
  const calledAtRef = useRef<Map<string, { obs: string; ts: number }>>(new Map());
  const [tick, setTick] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const beepAudioRef = useRef<HTMLAudioElement | null>(null);
  const ptVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [audioStatus, setAudioStatus] = useState("Aguardando teste de som");
  const [lucianoMessage, setLucianoMessage] = useState<string | null>(null);
  const [isAudioTest, setIsAudioTest] = useState(false);
  const lucianoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioTestTimerRef = useRef<NodeJS.Timeout | null>(null);


  // Load and keep voices updated
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      ptVoiceRef.current =
        voices.find(v => v.lang === "pt-BR") ||
        voices.find(v => v.lang.startsWith("pt")) ||
        null;
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { try { window.speechSynthesis.onvoiceschanged = null; } catch { /* noop */ } };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sampleRate = 44100;
    const duration = 1.05;
    const samples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    const writeString = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
    };
    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, samples * 2, true);
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      const active = (t < 0.28) || (t > 0.36 && t < 0.64) || (t > 0.72 && t < 1.0);
      const sample = active ? Math.sin(2 * Math.PI * 980 * t) * 0.85 : 0;
      view.setInt16(44 + i * 2, sample * 32767, true);
    }
    const blob = new Blob([buffer], { type: "audio/wav" });
    beepAudioRef.current = new Audio(URL.createObjectURL(blob));
    beepAudioRef.current.preload = "auto";
    beepAudioRef.current.volume = 1;
  }, []);

  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioCtor();
    }
    return audioContextRef.current;
  }, []);

  const playTone = useCallback(async (frequency = 880, start = 0, duration = 0.28, volume = 0.9) => {
    const ctx = getAudioContext();
    if (!ctx) return false;
    try {
      if (ctx.state === "suspended") await ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration + 0.05);
      return true;
    } catch (error) {
      console.error("[Painel] Erro no tone:", error);
      return false;
    }
  }, [getAudioContext]);

  const playAlert = useCallback(async () => {
    if (beepAudioRef.current) {
      try {
        beepAudioRef.current.currentTime = 0;
        await beepAudioRef.current.play();
        setAudioStatus("Bipe WAV executado");
        return;
      } catch (error) {
        console.warn("[Painel] Falha no WAV; tentando AudioContext", error);
      }
    }
    const ok = await playTone(980, 0, 0.3, 0.95);
    await playTone(980, 0.34, 0.3, 0.95);
    await playTone(980, 0.68, 0.3, 0.95);
    setAudioStatus(ok ? "Bipe AudioContext executado" : "Falha ao executar bipe");
  }, [playTone]);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      playAlert();
      return;
    }
    try {
      window.speechSynthesis.resume();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "pt-BR";
      utterance.rate = 0.86;
      utterance.pitch = 1;
      utterance.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang === "pt-BR") || voices.find(v => v.lang.startsWith("pt")) || ptVoiceRef.current;
      if (voice) utterance.voice = voice;
      utterance.onstart = () => setAudioStatus(`Falando: ${text}`);
      utterance.onerror = () => { setAudioStatus("Falha na voz; usando bipe"); playAlert(); };
      utterance.onend = () => setAudioStatus("Voz finalizada");
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error("[Painel] Erro ao falar:", error);
      setAudioStatus("Erro na voz; usando bipe");
      playAlert();
    }
  }, [playAlert]);

  const unlockAudio = useCallback(async () => {
    let ok = false;
    if (beepAudioRef.current) {
      try {
        beepAudioRef.current.currentTime = 0;
        await beepAudioRef.current.play();
        ok = true;
      } catch (error) {
        console.warn("[Painel] WAV bloqueado no unlock; tentando AudioContext", error);
      }
    }
    if (!ok) {
      ok = await playTone(523, 0, 0.18, 0.9);
      await playTone(659, 0.2, 0.18, 0.9);
      await playTone(784, 0.4, 0.24, 0.9);
    }
    setAudioUnlocked(ok);
    setAudioStatus(ok ? "Som liberado" : "Som bloqueado pelo navegador/dispositivo");
  }, [playTone]);

  // Unlock audio on first user interaction (browser requirement)
  useEffect(() => {
    const handleFirstInteraction = () => {
      console.log("[Painel] Primeiro toque detectado, liberando áudio...");
      unlockAudio();
      // Ensure speechSynthesis is resumeable
      if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.resume();
      }
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
    };
    window.addEventListener("click", handleFirstInteraction);
    window.addEventListener("keydown", handleFirstInteraction);
    window.addEventListener("touchstart", handleFirstInteraction);
    return () => {
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
    };
  }, [unlockAudio]);

  // Realtime for Luciano's custom message
  useEffect(() => {
    const channel = supabase
      .channel('luciano-painel-recv')
      .on('broadcast', { event: 'mensagem-luciano' }, (payload) => {
        console.log("[Painel] Luciano message received:", payload);
        if (payload.message) {
          setLucianoMessage(payload.message);
          if (payload.audio) {
            speak(`Atenção: ${payload.message}`);
          }
          
          // Clear existing timer if any
          if (lucianoTimerRef.current) clearTimeout(lucianoTimerRef.current);
          
          // Hide message after 15 seconds
          lucianoTimerRef.current = setTimeout(() => {
            setLucianoMessage(null);
          }, 15000);
        }
      })
        .on('broadcast', { event: 'audio-test' }, (payload) => {
          console.log("[Painel] Audio test received:", payload);
          setIsAudioTest(true);
          speak(payload.message || "Teste de áudio no painel");
          
          if (audioTestTimerRef.current) clearTimeout(audioTestTimerRef.current);
          audioTestTimerRef.current = setTimeout(() => {
            setIsAudioTest(false);
          }, 10000);
        })
        .subscribe();
    return () => { 
      supabase.removeChannel(channel); 
      if (lucianoTimerRef.current) clearTimeout(lucianoTimerRef.current);
      if (audioTestTimerRef.current) clearTimeout(audioTestTimerRef.current);
    };
  }, [speak]);

  const emAtendimentoRaw = useMemo(

    () => candidatos.filter(c => c.status === "em_atendimento"),
    [candidatos]
  );

  // Re-render every second so the 30s window is enforced even without DB events
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Filter: only show calls within the last 30 seconds.
  // We populate calledAtRef synchronously here (instead of in useEffect) so the
  // first render already has timestamps and nothing is hidden by accident.
  const emAtendimento = useMemo(() => {
    const map = calledAtRef.current;
    const now = Date.now();
    const currentIds = new Set<string>();
    for (const c of emAtendimentoRaw) {
      currentIds.add(c.id);
      const obs = c.observacoes || "";
      const prev = map.get(c.id);
      if (!prev || prev.obs !== obs) {
        map.set(c.id, { obs, ts: now });
      }
    }
    for (const id of Array.from(map.keys())) {
      if (!currentIds.has(id)) map.delete(id);
    }
    return emAtendimentoRaw.filter(c => {
      const entry = map.get(c.id);
      if (!entry) return false;
      return now - entry.ts < 30000;
    });
    // tick dependency forces re-evaluation every second
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emAtendimentoRaw, tick]);

  const proximos = useMemo(
    () => candidatos
      .filter(c => c.status === "na_fila_atendimento")
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    [candidatos]
  );

  // Play alert sound + speak candidate name when a NEW candidate appears or is re-called.
  // Use the RAW list (not filtered by 30s) so the speech detection isn't affected
  // by the 1s tick re-rendering the filtered emAtendimento.
  useEffect(() => {
    const currentMap = new Map(emAtendimentoRaw.map(c => [c.id, c.observacoes || ""]));
    const prevMap = previousMapRef.current;
    // Detect new candidates OR candidates whose observacoes changed (re-call)
    const newCandidates = emAtendimentoRaw.filter(c => {
      const prevObs = prevMap.get(c.id);
      return prevObs === undefined || prevObs !== (c.observacoes || "");
    });
    const hasNew = newCandidates.length > 0;

    if (hasNew && (prevMap.size > 0 || emAtendimentoRaw.length > 0)) {
      // Alerta sonoro (Bipe) - Toca sempre que houver chamada nova
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        
        // Volume do alerta (0 a 1)
        const volumeAlerta = 0.8; 

        [0, 0.3, 0.6].forEach(delay => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          // Frequência do bipe (mais agudo para chamar atenção)
          osc.frequency.value = 950; 
          osc.type = "sine";
          
          gain.gain.setValueAtTime(0, ctx.currentTime + delay);
          gain.gain.linearRampToValueAtTime(volumeAlerta, ctx.currentTime + delay + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.4);
          
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + 0.5);
        });
        console.log("[Painel] 🔔 Bipe de alerta executado");
      } catch (e) { 
        console.warn("[Painel] Erro ao tocar bipe de alerta:", e); 
      }

      // Fala do nome
      try {
        for (const candidate of newCandidates) {
          const nomeCandidato = candidate.nome;
          const atendenteNome = getAtendente(candidate);
          const atendenteUser = atendenteNome
            ? usuarios.find(u => u.nome.toLowerCase().trim() === atendenteNome.toLowerCase().trim())
            : null;
          const especialidade = (atendenteUser?.especialidade || "").toLowerCase();
          let destino = "";
          
          if (especialidade.includes("enferm")) destino = "à sala da enfermagem";
          else if (especialidade.includes("medic") || especialidade.includes("médic")) destino = "à sala do médico";
          else if (especialidade.includes("psicolog")) destino = "à sala da psicologia";
          else if (especialidade.includes("fono")) destino = "à sala da fono audióloga";
          else if (especialidade.includes("social")) destino = "à sala da assistência social";
          else if (especialidade.includes("seguranc") || especialidade.includes("seguranç")) destino = "à sala da segurança do trabalho";
          else if (atendenteNome) destino = `à sala de ${atendenteNome}`;
          
          const fraseDestino = destino ? `dirija-se ${destino}` : "dirija-se ao atendimento";

          if (nomeCandidato) {
            const frase = `${nomeCandidato}, ${fraseDestino}`;
            console.log("[Painel] 📢 Chamando via useEffect:", frase);
            // Repetir a chamada 2 vezes para garantir que ouçam
            speak(frase);
            setTimeout(() => speak(frase), 5000);
          }
        }
      } catch (e) { 
        console.error("[Painel] Erro ao disparar fala automática:", e); 
      }
    }

    previousMapRef.current = currentMap;
  }, [emAtendimentoRaw, usuarios, speak]);

  // Rotate through multiple em_atendimento every 6s
  useEffect(() => {
    if (emAtendimento.length <= 1) {
      setDisplayIndex(0);
      return;
    }
    const t = setInterval(() => setDisplayIndex(i => (i + 1) % emAtendimento.length), 6000);
    return () => clearInterval(t);
  }, [emAtendimento.length]);

  const shown = emAtendimento.length > 0 ? emAtendimento[displayIndex % emAtendimento.length] : null;
  const atendenteNome = shown ? getAtendente(shown) : null;
  const atendenteUser = useMemo(() => {
    if (!atendenteNome) return null;
    return usuarios.find(u => u.nome.toLowerCase() === atendenteNome.toLowerCase()) || null;
  }, [atendenteNome, usuarios]);

  const specialtyStyle = atendenteUser ? getSpecialtyStyle(atendenteUser.especialidade) : getSpecialtyStyle("");

  const isDiario = window.location.pathname === "/painel-diario";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ 
        background: isDiario 
          ? "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)" 
          : "linear-gradient(135deg, #0a1628 0%, #1a3a6b 50%, #0d2240 100%)" 
      }}>
        <p className="text-white text-2xl font-bold animate-pulse">Carregando painel...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col overflow-hidden relative"
      style={{ 
        background: isDiario 
          ? "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)" 
          : "linear-gradient(135deg, #0a1628 0%, #1a3a6b 50%, #0d2240 100%)" 
      }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, rgba(100,180,255,0.3) 0%, transparent 70%)" }} />
      </div>

      {/* Header */}
      <div className="relative z-10 pt-6 pb-4 px-8">
        <div className="flex flex-col items-center gap-4 mb-3">
          <img src={logoEmpresa} alt="Logo" className="h-32 md:h-44 w-auto object-contain opacity-20" />
          <div className="px-10 py-3 rounded-xl text-center"
            style={{
              background: isDiario 
                ? "linear-gradient(180deg, rgba(67, 56, 202, 0.9) 0%, rgba(49, 46, 129, 0.9) 100%)" 
                : "linear-gradient(180deg, rgba(40,80,140,0.9) 0%, rgba(30,60,110,0.9) 100%)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}>
            <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-widest"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
              Painel de Atendimento
            </h1>
          </div>
        </div>
        <p className="text-center text-sm md:text-base font-semibold tracking-widest uppercase"
          style={{ color: "rgba(180,210,255,0.8)" }}>
          <Clock />
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center relative z-10 px-8 py-4">
        {isAudioTest ? (
          <div className="flex flex-col items-center gap-8 w-full max-w-5xl animate-pulse">
            <div 
              className="w-full rounded-3xl px-12 py-16 text-center shadow-2xl border-4 border-green-400/50 bg-green-900/40 backdrop-blur-xl"
            >
              <p className="font-black text-white uppercase tracking-wider text-5xl md:text-7xl leading-tight"
                style={{ textShadow: "0 4px 20px rgba(0,0,0,0.6)" }}>
                📢 TESTE DE SOM ATIVO
              </p>
              <p className="mt-4 text-2xl text-green-200 font-bold uppercase tracking-widest">
                VERIFICANDO ÁUDIO DO PAINEL
              </p>
            </div>
          </div>
        ) : lucianoMessage ? (
          <div className="flex flex-col items-center gap-8 w-full max-w-5xl animate-fade-in">
            <div 
              className="w-full rounded-3xl px-12 py-16 text-center shadow-2xl border-4 border-blue-400/50"
              style={{
                background: "linear-gradient(135deg, rgba(30,58,138,0.9) 0%, rgba(30,64,175,0.8) 100%)",
                backdropFilter: "blur(20px)",
              }}
            >
              <p className="font-black text-white uppercase tracking-wider text-5xl md:text-7xl leading-tight"
                style={{ textShadow: "0 4px 20px rgba(0,0,0,0.6)" }}>
                {lucianoMessage}
              </p>
            </div>
          </div>
        ) : !shown ? (
          <div className="flex flex-col items-center gap-6">
            <p className="text-2xl md:text-4xl font-black uppercase tracking-widest text-center"
              style={{ color: "rgba(180,210,255,0.85)", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
              AGUARDE LOGO VOCÊ SERA CHAMADO
            </p>
          </div>
        ) : (

          <div className="flex flex-col items-center gap-6 w-full max-w-4xl">
            {/* Candidate Name */}
            <div key={shown.id}
              className="w-full rounded-2xl px-8 py-8 text-center animate-fade-in"
              style={{
                background: "linear-gradient(135deg, rgba(60,120,200,0.25) 0%, rgba(40,80,150,0.15) 100%)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(100,170,255,0.2)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}>
              <p className="font-black text-white uppercase tracking-wider text-4xl md:text-6xl animate-scale-in"
                style={{ textShadow: "0 2px 15px rgba(0,0,0,0.4)" }}>
                {shown.nome}
              </p>
            </div>

            {/* Professional Info — colored by specialty */}
            <div className="rounded-xl px-10 py-5 text-center min-w-[320px]"
              style={{
                background: specialtyStyle.bg,
                boxShadow: "0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
                border: `1px solid ${specialtyStyle.border}`,
              }}>
              {atendenteUser?.sala ? (
                <p className="text-lg md:text-2xl font-bold uppercase tracking-widest mb-2"
                  style={{ color: specialtyStyle.label }}>
                  {atendenteUser.sala}
                </p>
              ) : (
                <p className="text-lg md:text-2xl font-bold uppercase tracking-widest mb-2"
                  style={{ color: "rgba(255,255,255,0.5)" }}>
                  Atendente
                </p>
              )}
              <div className="flex items-center justify-center gap-3">
                <p className="font-black text-white uppercase tracking-wide text-2xl md:text-4xl"
                  style={{ textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                  {atendenteNome || "—"}
                </p>
                {atendenteUser?.especialidade && (
                  <>
                    <span className="text-white/50 text-2xl md:text-3xl font-light">/</span>
                    <span className="font-bold text-white uppercase tracking-wider text-xl md:text-3xl"
                      style={{ textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                      {atendenteUser.especialidade}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Multiple attendances indicator */}
            {emAtendimento.length > 1 && (
              <div className="flex gap-2 items-center">
                {emAtendimento.map((_, i) => (
                  <div key={i} className={cn(
                    "w-3 h-3 rounded-full transition-all",
                    i === displayIndex % emAtendimento.length ? "bg-white scale-125" : "bg-white/30"
                  )} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {/* Removed "Próximos" section - not requested */}

      <div className="absolute bottom-6 right-8 text-white/20 text-3xl pointer-events-none">✦</div>
      <div className="absolute top-20 left-10 text-white/10 text-2xl pointer-events-none">✦</div>

      {/* Audio control: unlock (required for browser policy) */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-2 z-20">
        {!audioUnlocked && (
          <Button 
            onClick={unlockAudio}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-full shadow-lg flex items-center gap-2 animate-bounce"
          >
            <Activity className="h-5 w-5" /> CLIQUE PARA ATIVAR O SOM
          </Button>
        )}
        <div className="text-[10px] text-white/30 uppercase tracking-tighter">
          Status: {audioStatus}
        </div>
      </div>
    </div>
  );
}

